#!/usr/bin/env bash
set -euo pipefail

# First deployment on an Ubuntu server. --check validates inputs without changes.
check_only=false
if [[ "${1:-}" == "--check" ]]; then
  check_only=true
  shift
fi
if [[ $# -ne 2 ]]; then
  echo 'Usage: sudo bash deploy/bootstrap-ubuntu.sh [--check] DOMAIN CONTACT_EMAIL' >&2
  exit 2
fi
site_domain=${1,,}
site_email=$2
domain_pattern='^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'
email_pattern='^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
if [[ ${#site_domain} -gt 253 ]] || [[ ! "$site_domain" =~ $domain_pattern ]]; then
  echo 'DOMAIN must be a plain DNS hostname, without a scheme, path or shell characters.' >&2
  exit 2
fi
if [[ ! "$site_email" =~ $email_pattern ]]; then
  echo 'CONTACT_EMAIL must be a valid contact email address.' >&2
  exit 2
fi
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd -- "$project_dir"
for required_file in Dockerfile package.json package-lock.json deploy/compose.yaml deploy/Caddyfile deploy/start.mjs deploy/env.example; do
  if [[ ! -f "$required_file" ]]; then
    echo "Missing project file: $required_file" >&2
    exit 2
  fi
done
if [[ -e deploy/.env ]]; then
  echo 'Existing deploy/.env found. Use the regular Compose deployment to preserve its configuration.' >&2
  exit 2
fi
if [[ "$check_only" == true ]]; then
  echo 'Checks passed: valid hostname/email, complete project files, no existing configuration.'
  echo 'No settings changed; Docker was not installed and the site was not started.'
  exit 0
fi
if [[ "$site_domain" == example.com || "$site_domain" == *.example.com || "$site_domain" == *.example || "$site_domain" == *.invalid || "$site_domain" == *.test || "$site_domain" == localhost* ]]; then
  echo 'Replace the placeholder with a domain you own and have pointed to this server.' >&2
  exit 2
fi
if [[ "$OSTYPE" != linux* ]] || [[ $EUID -ne 0 ]]; then
  echo 'Run the deployment on the Ubuntu server using sudo.' >&2
  exit 2
fi
if [[ ! -f /etc/os-release ]]; then
  echo 'Cannot identify the server operating system.' >&2
  exit 2
fi
source /etc/os-release
if [[ "${ID:-}" != ubuntu ]] || [[ ! "${VERSION_ID:-}" =~ ^(22\.04|24\.04|26\.04)$ ]]; then
  echo 'Supported server systems: Ubuntu 22.04, 24.04 or 26.04 LTS.' >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1; then
  # Use the official Ubuntu package repository, not an unreviewed installer.
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  docker_key=$(mktemp /tmp/wenbing-docker-key.XXXXXX)
  cleanup_key() { rm -f -- "$docker_key"; }
  trap cleanup_key EXIT
  curl --fail --silent --show-error --location --retry 2 --max-time 60 https://download.docker.com/linux/ubuntu/gpg -o "$docker_key"
  install -m 0644 "$docker_key" /etc/apt/keyrings/docker.asc
  docker_arch=$(dpkg --print-architecture)
  docker_suite=${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}
  if [[ -z "$docker_suite" ]]; then
    echo 'Ubuntu package codename missing.' >&2
    exit 2
  fi
  printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$docker_suite" "$docker_arch" > /etc/apt/sources.list.d/docker.sources
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  cleanup_key
  trap - EXIT
fi
if ! docker compose version >/dev/null 2>&1; then
  echo 'Docker Compose plugin missing. Install it following the official Docker instructions.' >&2
  exit 2
fi
systemctl start docker
docker info >/dev/null

# Exclusive, private, first-time configuration; a repeated run never replaces it.
umask 077
if [[ -e deploy/.env ]]; then
  echo 'Configuration appeared during setup. It has been preserved; stopping.' >&2
  exit 2
fi
(set -o noclobber
  printf 'DOMAIN=%s\nTLS_EMAIL=%s\n' "$site_domain" "$site_email" > deploy/.env
)
chmod 600 deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml build
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d app
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
echo 'Application prepared on the private container network; public HTTPS has not been started.'
echo 'After ICP filing and domain DNS are ready, start public HTTPS from the project directory:'
echo 'sudo docker compose --env-file deploy/.env -f deploy/compose.yaml up -d'
echo "Then check https://$site_domain/api/health and test the website on a real mobile network."
