; Clara Installer Custom Script
; This file contains custom NSIS installer script instructions

!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
!macroend

!macro customInit
  ; Custom initialization code can go here
!macroend

!macro customInstall
  ; Custom installation code can go here
  ; For example, you might want to install additional components
!macroend

!macro customUnInit
  ; Custom uninstaller initialization code can go here
!macroend

!macro customUnInstall
  ; Custom uninstallation code can go here
  ; Clean up registry entries, files, etc.
!macroend

!macro customRemoveFiles
  ; Remove additional files that are not automatically removed
!macroend

; Set installer/uninstaller properties
!macro customHeader
  ; Custom header code can go here
!macroend

; Custom page(s) can be defined here if needed
; !macro customWelcomePage
;   ; Custom welcome page code
; !macroend 