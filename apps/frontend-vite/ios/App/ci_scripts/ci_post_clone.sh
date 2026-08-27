#!/bin/sh

set -eu

SCRIPT_DIRECTORY="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(CDPATH= cd -- "${SCRIPT_DIRECTORY}/../../../../.." && pwd)}"
FRONTEND_DIRECTORY="${REPOSITORY_ROOT}/apps/frontend-vite"

install_build_tools() {
  if ! command -v node >/dev/null 2>&1; then
    brew install node@22
    PATH="$(brew --prefix node@22)/bin:${PATH}"
    export PATH
  fi

  if ! command -v corepack >/dev/null 2>&1; then
    npm install --global corepack@0.34.0
  fi

  if ! command -v pod >/dev/null 2>&1; then
    brew install cocoapods
  fi
}

require_release_environment() {
  required_variables="
VITE_BACKEND_URL
VITE_CLERK_PUBLISHABLE_KEY
VITE_GOOGLE_IOS_CLIENT_ID
VITE_GOOGLE_WEB_CLIENT_ID
"

  for variable_name in ${required_variables}; do
    eval "variable_value=\${${variable_name}:-}"
    if [ -z "${variable_value}" ]; then
      echo "error: Configure ${variable_name} in the Xcode Cloud workflow environment." >&2
      exit 1
    fi
  done

  for url_variable_name in VITE_BACKEND_URL; do
    eval "url_variable_value=\${${url_variable_name}}"
    case "${url_variable_value}" in
      https://*) ;;
      *)
        echo "error: ${url_variable_name} must use a production HTTPS URL." >&2
        exit 1
        ;;
    esac
  done
}

run_pnpm() {
  corepack pnpm "$@"
}

require_release_environment
install_build_tools

cd "${REPOSITORY_ROOT}"
run_pnpm install --frozen-lockfile

run_pnpm --dir "${FRONTEND_DIRECTORY}" build:cap
run_pnpm --dir "${FRONTEND_DIRECTORY}" exec cap sync ios
