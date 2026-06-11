#!/usr/bin/env bash
set -euo pipefail

sudo_cmd() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif [[ -n "${WSL_SUDO_PASSWORD:-}" ]]; then
    printf '%s\n' "${WSL_SUDO_PASSWORD}" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

have() {
  command -v "$1" >/dev/null 2>&1
}

echo "Checking Linux package metadata..."
sudo_cmd apt-get update

missing_packages=()
have vina || missing_packages+=("autodock-vina")
have obabel || missing_packages+=("openbabel")
have xtb || missing_packages+=("xtb")
have curl || missing_packages+=("curl")
have gpg || missing_packages+=("gnupg")
have lsb_release || missing_packages+=("lsb-release")

if [[ "${#missing_packages[@]}" -gt 0 ]]; then
  echo "Installing packages: ${missing_packages[*]}"
  sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates "${missing_packages[@]}"
else
  echo "APT tools already present: vina, obabel, xtb, curl."
fi

if ! have smina; then
  echo "Installing smina static binary..."
  tmp="$(mktemp)"
  curl -L --fail --show-error -o "${tmp}" "https://sourceforge.net/projects/smina/files/smina.static/download"
  chmod +x "${tmp}"
  sudo_cmd mv "${tmp}" /usr/local/bin/smina
else
  echo "smina already present."
fi

install_gnina_runtime_deps() {
  local gnina_path="$1"
  local missing_libs
  missing_libs="$(ldd "${gnina_path}" 2>/dev/null | awk '/not found/{print $1}' || true)"
  if [[ -z "${missing_libs}" ]]; then
    echo "GNINA shared library dependencies are satisfied."
    return
  fi

  echo "Installing CUDA/cuDNN runtime libraries required by GNINA:"
  echo "${missing_libs}"
  sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    libcudart12 libcublas12 libcublaslt12 libcusparse12 libcufft11 libcusolver11 libnvtoolsext1 || true

  if echo "${missing_libs}" | grep -q "libcudnn"; then
    . /etc/os-release
    cuda_repo="ubuntu${VERSION_ID//./}"
    keyring="/tmp/cuda-keyring_1.1-1_all.deb"
    if curl -L --fail --show-error -o "${keyring}" "https://developer.download.nvidia.com/compute/cuda/repos/${cuda_repo}/x86_64/cuda-keyring_1.1-1_all.deb"; then
      sudo_cmd dpkg -i "${keyring}"
      sudo_cmd apt-get update
      sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -y cudnn9-cuda-12 || true
    else
      echo "Could not download NVIDIA CUDA keyring for ${cuda_repo}; install cudnn9-cuda-12 manually if GNINA still reports libcudnn missing."
    fi
  fi

  missing_libs="$(ldd "${gnina_path}" 2>/dev/null | awk '/not found/{print $1}' || true)"
  if [[ -n "${missing_libs}" ]]; then
    echo "GNINA is installed, but these libraries are still missing:"
    echo "${missing_libs}"
    return 1
  fi
}

if ! have gnina; then
  gnina_version="${GNINA_VERSION:-1.3.2}"
  gnina_asset="${GNINA_ASSET:-gnina.${gnina_version}}"
  gnina_url="${GNINA_URL:-https://github.com/gnina/gnina/releases/download/v${gnina_version}/${gnina_asset}}"
  echo "Installing GNINA ${gnina_version} binary..."
  tmp="$(mktemp)"
  curl -L --fail --show-error -o "${tmp}" "${gnina_url}"
  chmod +x "${tmp}"
  sudo_cmd mv "${tmp}" /usr/local/bin/gnina
else
  echo "gnina already present."
fi

install_gnina_runtime_deps "$(command -v gnina)"

echo
echo "Resolved tool versions:"
vina --version || true
smina --help | head -n 3 || true
gnina --version || true
obabel -V || true
xtb --version | head -n 8 || true
