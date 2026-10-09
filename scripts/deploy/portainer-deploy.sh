#!/usr/bin/env bash
# Production deploy through the Portainer API:
#   1. pg_dump backup inside the DB volume (keeps the last 10 pre-deploy dumps)
#   2. git redeploy of the stack (rebuilds from main; entrypoint runs migrations + seed)
#   3. health check of the public app
# Required env: PORTAINER_URL, PORTAINER_API_KEY, PORTAINER_ENDPOINT_ID, PORTAINER_STACK_ID,
#               DB_CONTAINER, APP_URL, DEPLOY_SHA
# Optional: DRY_RUN=1 runs the backup and the health check but skips the redeploy
set -euo pipefail

: "${PORTAINER_URL:?}" "${PORTAINER_API_KEY:?}" "${PORTAINER_ENDPOINT_ID:?}" "${PORTAINER_STACK_ID:?}"
: "${DB_CONTAINER:?}" "${APP_URL:?}" "${DEPLOY_SHA:?}"

# Portainer uses a self-signed certificate
api() {
	curl -sSk --fail-with-body -H "X-API-Key: ${PORTAINER_API_KEY}" -H "Content-Type: application/json" "$@"
}
DOCKER="${PORTAINER_URL}/api/endpoints/${PORTAINER_ENDPOINT_ID}/docker"

# Run a shell command in a container; prints output, fails on non-zero exit code
container_exec() {
	local container=$1 cmd=$2 id code
	id=$(api -X POST "${DOCKER}/containers/${container}/exec" \
		-d "$(jq -n --arg c "$cmd" '{AttachStdout: true, AttachStderr: true, Cmd: ["sh", "-c", $c]}')" | jq -r .Id)
	api -X POST "${DOCKER}/exec/${id}/start" -d '{"Detach": false, "Tty": true}'
	echo
	code=$(api "${DOCKER}/exec/${id}/json" | jq -r .ExitCode)
	[ "$code" = "0" ] || { echo "::error::exec in ${container} failed (exit ${code})"; return 1; }
}

echo "::group::1. Backup de la base"
short=${DEPLOY_SHA:0:7}
container_exec "$DB_CONTAINER" "set -e
dir=/var/lib/postgresql/data/backups
mkdir -p \$dir
f=\$dir/predeploy-${short}-\$(date +%Y%m%d-%H%M%S).dump
pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc -f \$f
pg_restore -l \$f > /dev/null
ls -la \$f
ls -t \$dir/predeploy-*.dump | tail -n +11 | xargs -r rm --"
echo "::endgroup::"

echo "::group::2. Redéploiement de la stack ${PORTAINER_STACK_ID}"
if [ "${DRY_RUN:-0}" = "1" ]; then
	echo "DRY_RUN=1 : redéploiement ignoré"
else
env_json=$(api "${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}" | jq -c '.Env // []')
api -m 1500 -X PUT "${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}/git/redeploy?endpointId=${PORTAINER_ENDPOINT_ID}" \
	-d "$(jq -n --argjson env "$env_json" \
		'{RepositoryReferenceName: "refs/heads/main", RepositoryAuthentication: false, Env: $env, Prune: false, PullImage: false}')" \
	| jq '{Name, Status, deployed: .GitConfig.ConfigHash}'
fi
echo "::endgroup::"

echo "::group::3. Vérification"
for i in $(seq 1 30); do
	if curl -sSf -m 10 "${APP_URL}/api/trpc/settings.public" | jq -e '.result.data.sigle' > /dev/null 2>&1; then
		echo "Application OK (${APP_URL})"
		echo "::endgroup::"
		exit 0
	fi
	sleep 10
done
echo "::error::Application not healthy after deploy (${APP_URL}). Restore: see docs/18_ci_cd.md"
exit 1
