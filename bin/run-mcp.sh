#!/bin/zsh
SCRIPT_DIR="${0:A:h}"
PROJECT_ROOT="${SCRIPT_DIR:h}"
exec "${SCRIPT_DIR}/run-node.sh" "${PROJECT_ROOT}/src/index.mjs" "$@"
