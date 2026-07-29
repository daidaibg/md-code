; 仅把 MD Code 注册到 Windows“打开方式”，不抢占任何扩展名的默认程序。
!macro MD_CODE_SUPPORTED_TYPE EXT
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".${EXT}" ""
!macroend

; 清理由旧安装包直接写入的默认关联，并尽可能恢复安装前的关联。
!macro MD_CODE_RESTORE_LEGACY_ASSOCIATION EXT
  ReadRegStr $R8 HKCU "Software\Classes\.${EXT}" ""
  StrCmp $R8 "MD Code Document" 0 md_code_restore_${EXT}_done

  ReadRegStr $R9 HKCU "Software\Classes\.${EXT}" "MD Code Document_backup"
  StrCmp $R9 "MD Code Document" 0 +2
  StrCpy $R9 ""
  WriteRegStr HKCU "Software\Classes\.${EXT}" "" "$R9"
  DeleteRegValue HKCU "Software\Classes\.${EXT}" "MD Code Document_backup"

  md_code_restore_${EXT}_done:
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "md"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "markdown"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "mdown"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "mkd"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "json"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "jsonc"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "html"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "htm"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "css"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "scss"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "less"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "js"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "mjs"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "cjs"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "jsx"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "ts"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "mts"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "cts"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "tsx"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "yaml"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "yml"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "xml"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "svg"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "txt"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "log"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "ini"
  !insertmacro MD_CODE_RESTORE_LEGACY_ASSOCIATION "conf"

  DeleteRegKey HKCU "Software\Classes\MD Code Document"

  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "${PRODUCTNAME}"
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\DefaultIcon" "" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open" "" "使用 ${PRODUCTNAME} 打开"
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" '$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\"'

  !insertmacro MD_CODE_SUPPORTED_TYPE "md"
  !insertmacro MD_CODE_SUPPORTED_TYPE "markdown"
  !insertmacro MD_CODE_SUPPORTED_TYPE "mdown"
  !insertmacro MD_CODE_SUPPORTED_TYPE "mkd"
  !insertmacro MD_CODE_SUPPORTED_TYPE "json"
  !insertmacro MD_CODE_SUPPORTED_TYPE "jsonc"
  !insertmacro MD_CODE_SUPPORTED_TYPE "html"
  !insertmacro MD_CODE_SUPPORTED_TYPE "htm"
  !insertmacro MD_CODE_SUPPORTED_TYPE "css"
  !insertmacro MD_CODE_SUPPORTED_TYPE "scss"
  !insertmacro MD_CODE_SUPPORTED_TYPE "less"
  !insertmacro MD_CODE_SUPPORTED_TYPE "js"
  !insertmacro MD_CODE_SUPPORTED_TYPE "mjs"
  !insertmacro MD_CODE_SUPPORTED_TYPE "cjs"
  !insertmacro MD_CODE_SUPPORTED_TYPE "jsx"
  !insertmacro MD_CODE_SUPPORTED_TYPE "ts"
  !insertmacro MD_CODE_SUPPORTED_TYPE "mts"
  !insertmacro MD_CODE_SUPPORTED_TYPE "cts"
  !insertmacro MD_CODE_SUPPORTED_TYPE "tsx"
  !insertmacro MD_CODE_SUPPORTED_TYPE "yaml"
  !insertmacro MD_CODE_SUPPORTED_TYPE "yml"
  !insertmacro MD_CODE_SUPPORTED_TYPE "xml"
  !insertmacro MD_CODE_SUPPORTED_TYPE "svg"
  !insertmacro MD_CODE_SUPPORTED_TYPE "txt"
  !insertmacro MD_CODE_SUPPORTED_TYPE "log"
  !insertmacro MD_CODE_SUPPORTED_TYPE "ini"
  !insertmacro MD_CODE_SUPPORTED_TYPE "conf"

  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)"
!macroend
