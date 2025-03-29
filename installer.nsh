!macro customInit
  # Check for Python installation
  nsExec::ExecToStack 'python --version'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_YESNO "Python 3 is required but not found. Would you like to download and install it now?" IDYES download IDNO continue
    download:
      ExecShell "open" "https://www.python.org/downloads/"
    continue:
  ${EndIf}
!macroend
