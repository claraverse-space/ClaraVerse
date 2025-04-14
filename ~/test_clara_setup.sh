#!/bin/bash

# Script to test Clara setup on a clean environment
# This script will:
# 1. Backup existing NVM and Node installations
# 2. Allow testing Clara's setup process
# 3. Restore the original environment

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

backup_dir="$HOME/clara_test_backup"
nvm_dir="$HOME/.nvm"
n8n_binary=$(which n8n 2>/dev/null)

function backup_environment() {
  echo -e "${YELLOW}Backing up your environment...${NC}"
  
  # Backup NVM if it exists
  if [ -d "$nvm_dir" ]; then
    echo "Moving NVM to backup location..."
    mv "$nvm_dir" "$backup_dir/nvm_backup"
  fi
  
  # Backup shell config to remove NVM references
  for config in ~/.zshrc ~/.bashrc ~/.bash_profile; do
    if [ -f "$config" ]; then
      echo "Backing up $config..."
      cp "$config" "$backup_dir/$(basename $config).backup"
      # Comment out NVM related lines
      sed -i.bak 's/^.*NVM_DIR.*$/# &/' "$config"
    fi
  done
  
  # Clear NVM from current session
  unset NVM_DIR
  unset -f nvm node npm n8n
  
  echo -e "${GREEN}Environment backed up and cleared!${NC}"
  echo -e "${YELLOW}Now you can run the Clara app to test the setup process.${NC}"
  echo -e "When finished testing, run this script with the 'restore' argument:"
  echo -e "${GREEN}bash ~/test_clara_setup.sh restore${NC}"
}

function restore_environment() {
  echo -e "${YELLOW}Restoring your original environment...${NC}"
  
  # Restore NVM
  if [ -d "$backup_dir/nvm_backup" ]; then
    echo "Restoring NVM..."
    # Remove any newly created NVM directory
    [ -d "$nvm_dir" ] && rm -rf "$nvm_dir"
    # Move backup back to original location
    mv "$backup_dir/nvm_backup" "$nvm_dir"
  fi
  
  # Restore shell configs
  for config in ~/.zshrc ~/.bashrc ~/.bash_profile; do
    backup="$backup_dir/$(basename $config).backup"
    if [ -f "$backup" ]; then
      echo "Restoring $config..."
      cp "$backup" "$config"
    fi
  done
  
  echo -e "${GREEN}Environment restored!${NC}"
  echo -e "${YELLOW}You may need to close and reopen your terminal or run:${NC}"
  echo -e "${GREEN}source ~/.zshrc${NC}"
}

# Main script execution
if [ "$1" == "restore" ]; then
  restore_environment
else
  backup_environment
fi 