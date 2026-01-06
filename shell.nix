{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs
    nodePackages.node-gyp
    python313
    python313Packages.setuptools
    python313Packages.wheel
    python313Packages.distutils

    # Document processing libraries
    python313Packages.pypdf2
    python313Packages.python-docx
    python313Packages.python-pptx
    python313Packages.pandas
    python313Packages.openpyxl
    python313Packages.xlrd
    python313Packages.striprtf
    python313Packages.beautifulsoup4

    # Build tools
    gcc
    cmake
    pkg-config
  ];

  shellHook = ''
    # make sure node-gyp/npm use the shell python
    export npm_config_python=${pkgs.python313}/bin/python3
  '';
}
