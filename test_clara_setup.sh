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
node_bin=$(which node 2>/dev/null)
npm_bin=$(which npm 2>/dev/null)
n8n_bin=$(which n8n 2>/dev/null)

# Detect shell configuration file
if [ -n "$ZSH_VERSION" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
  SHELL_RC="$HOME/.bashrc"
  # On macOS, bash might use .bash_profile instead
  if [ "$(uname)" = "Darwin" ] && [ -f "$HOME/.bash_profile" ]; then
    SHELL_RC="$HOME/.bash_profile"
  fi
else
  SHELL_RC="$HOME/.profile"
fi

function backup_environment() {
  echo -e "${YELLOW}Backing up your environment...${NC}"
  
  # Create backup directory if it doesn't exist
  mkdir -p "$backup_dir"
  
  # Backup NVM if it exists
  if [ -d "$nvm_dir" ]; then
    echo "Moving NVM to backup location..."
    if [ -d "$backup_dir/nvm_backup" ]; then
      rm -rf "$backup_dir/nvm_backup"
    fi
    mv "$nvm_dir" "$backup_dir/nvm_backup"
  fi
  
  # Backup Node.js binaries if they exist outside NVM
  if [ -n "$node_bin" ] && [[ "$node_bin" != *".nvm"* ]]; then
    echo "Backing up Node.js binary at $node_bin..."
    cp "$node_bin" "$backup_dir/node_backup"
    echo "Removing Node.js binary..."
    if [ "$(uname)" = "Darwin" ]; then
      sudo rm "$node_bin" 2>/dev/null || rm "$node_bin" 2>/dev/null || echo "Failed to remove Node.js binary"
    else
      sudo rm "$node_bin" 2>/dev/null || echo "Failed to remove Node.js binary"
    fi
  fi
  
  if [ -n "$npm_bin" ] && [[ "$npm_bin" != *".nvm"* ]]; then
    echo "Backing up npm binary at $npm_bin..."
    cp "$npm_bin" "$backup_dir/npm_backup"
    echo "Removing npm binary..."
    if [ "$(uname)" = "Darwin" ]; then
      sudo rm "$npm_bin" 2>/dev/null || rm "$npm_bin" 2>/dev/null || echo "Failed to remove npm binary"
    else
      sudo rm "$npm_bin" 2>/dev/null || echo "Failed to remove npm binary"
    fi
  fi
  
  if [ -n "$n8n_bin" ]; then
    echo "Backing up n8n binary at $n8n_bin..."
    cp "$n8n_bin" "$backup_dir/n8n_backup"
    echo "Removing n8n binary..."
    if [ "$(uname)" = "Darwin" ]; then
      sudo rm "$n8n_bin" 2>/dev/null || rm "$n8n_bin" 2>/dev/null || echo "Failed to remove n8n binary"
    else
      sudo rm "$n8n_bin" 2>/dev/null || echo "Failed to remove n8n binary"
    fi
  fi
  
  # Backup global npm packages
  echo "Backing up list of global npm packages..."
  if command -v npm &> /dev/null; then
    npm list -g --depth=0 > "$backup_dir/global_npm_packages.txt"
  fi
  
  # Backup shell config
  echo "Backing up shell configuration at $SHELL_RC..."
  if [ -f "$SHELL_RC" ]; then
    cp "$SHELL_RC" "$backup_dir/shell_rc.backup"
    
    # Create temporary file for sed on macOS
    temp_file=$(mktemp)
    
    # Comment out NVM and Node related lines using macOS-compatible sed
    if [ "$(uname)" = "Darwin" ]; then
      sed -i '' 's/^.*NVM_DIR.*$/# &/' "$SHELL_RC"
      sed -i '' 's/^.*export PATH=.*node.*$/# &/' "$SHELL_RC"
    else
      sed -i 's/^.*NVM_DIR.*$/# &/' "$SHELL_RC"
      sed -i 's/^.*export PATH=.*node.*$/# &/' "$SHELL_RC"
    fi
    
    rm -f "$temp_file"
  fi
  
  # Clear environment variables from current session
  echo "Clearing environment variables..."
  unset NVM_DIR
  unset -f nvm node npm n8n
  
  # Try to unset PATH components related to Node.js
  if [ -n "$PATH" ]; then
    echo "Cleaning PATH variable of node-related entries..."
    export PATH=$(echo $PATH | tr ":" "\n" | grep -v "node\|npm\|nvm" | tr "\n" ":" | sed 's/:$//')
  fi
  
  echo -e "${GREEN}Environment backed up and cleared!${NC}"
  echo -e "${YELLOW}Now you can run the Clara app to test the setup process.${NC}"
  echo -e "When finished testing, run this script with the 'restore' argument:"
  echo -e "${GREEN}bash ./test_clara_setup.sh restore${NC}"
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
  
  # Restore Node.js binaries
  if [ -f "$backup_dir/node_backup" ] && [ -n "$node_bin" ]; then
    echo "Restoring Node.js binary..."
    if [ "$(uname)" = "Darwin" ]; then
      sudo cp "$backup_dir/node_backup" "$node_bin" 2>/dev/null || cp "$backup_dir/node_backup" "$node_bin" 2>/dev/null || echo "Failed to restore Node.js binary"
      sudo chmod +x "$node_bin" 2>/dev/null || chmod +x "$node_bin" 2>/dev/null || echo "Failed to make Node.js binary executable"
    else
      sudo cp "$backup_dir/node_backup" "$node_bin" || echo "Failed to restore Node.js binary"
      sudo chmod +x "$node_bin" || echo "Failed to make Node.js binary executable"
    fi
  fi
  
  if [ -f "$backup_dir/npm_backup" ] && [ -n "$npm_bin" ]; then
    echo "Restoring npm binary..."
    if [ "$(uname)" = "Darwin" ]; then
      sudo cp "$backup_dir/npm_backup" "$npm_bin" 2>/dev/null || cp "$backup_dir/npm_backup" "$npm_bin" 2>/dev/null || echo "Failed to restore npm binary"
      sudo chmod +x "$npm_bin" 2>/dev/null || chmod +x "$npm_bin" 2>/dev/null || echo "Failed to make npm binary executable"
    else
      sudo cp "$backup_dir/npm_backup" "$npm_bin" || echo "Failed to restore npm binary"
      sudo chmod +x "$npm_bin" || echo "Failed to make npm binary executable"
    fi
  fi
  
  if [ -f "$backup_dir/n8n_backup" ] && [ -n "$n8n_bin" ]; then
    echo "Restoring n8n binary..."
    if [ "$(uname)" = "Darwin" ]; then
      sudo cp "$backup_dir/n8n_backup" "$n8n_bin" 2>/dev/null || cp "$backup_dir/n8n_backup" "$n8n_bin" 2>/dev/null || echo "Failed to restore n8n binary"
      sudo chmod +x "$n8n_bin" 2>/dev/null || chmod +x "$n8n_bin" 2>/dev/null || echo "Failed to make n8n binary executable"
    else
      sudo cp "$backup_dir/n8n_backup" "$n8n_bin" || echo "Failed to restore n8n binary"
      sudo chmod +x "$n8n_bin" || echo "Failed to make n8n binary executable"
    fi
  fi
  
  # Restore shell config
  if [ -f "$backup_dir/shell_rc.backup" ]; then
    echo "Restoring shell configuration..."
    cp "$backup_dir/shell_rc.backup" "$SHELL_RC"
  fi
  
  echo -e "${GREEN}Environment restored!${NC}"
  echo -e "${YELLOW}You may need to close and reopen your terminal or run:${NC}"
  echo -e "${GREEN}source $SHELL_RC${NC}"
}

# Main script execution
if [ "$1" == "restore" ]; then
  restore_environment
else
  backup_environment
fi 