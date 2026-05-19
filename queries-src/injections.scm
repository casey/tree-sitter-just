; Specify nested languages that live within a `justfile`

; FIXME: these are not compatible with helix due to precedence SKIP-NVIM SKIP-NVIM-OLD

; ================ Always applicable ================

((comment) @injection.content
  (#set! injection.language "comment"))

; Highlight the RHS of `=~` as regex
((regex_literal
  (_) @injection.content)
  (#set! injection.language "regex"))

; ================ Global defaults ================

;; Default everything to be bash
; (recipe_body
;   !shebang
;   (#set! injection.language "bash")
;   (#set! injection.include-children)) @injection.content
;
; (external_command
;   (command_body) @injection.content
;   (#set! injection.language "bash"))

; ================ Global language specified ================
; Global language is set with something like one of the following:
;
;    set shell := ["bash", "-c", ...]
;    set shell := ["pwsh.exe"]
;
; We extract the first item of the array and its string_content. The old query
; had special cases for powershell (incl maybe `.exe`) and everything that has
; no extension ("hopefully" ???), which is then separated with a `#match?`. This
; author has no clue whether we still need this, but absent more experience with
; treesitter, he tried to replicate it to keep it around.
;
; > [...] Should at least look fine since they default to bash. Limitations...
; > See https://github.com/tree-sitter/tree-sitter/issues/880 for more on that.
;
; Heartbreaking: Idk how to make the default/fallback bash highlights play nice
; with the dynamic injection, so I removed it. They fight over the priorities,
; with whether one highlights over the other being apparently completely random.

(source_file
  (setting
    "shell"
    element: (string (string_content) @_lang
      (#match? @_lang ".*(powershell|pwsh|cmd).*"))
    (#set! injection.language "powershell"))
  [
    (recipe
      (recipe_body
        !shebang) @injection.content
      (#set! injection.include-children))

    (assignment
      (expression
        (value
          (external_command
            (command_body) @injection.content))))
  ])

(source_file
  (setting
    "shell"
    element: (string (string_content) @injection.language
      (#not-match? @injection.language ".*(powershell|pwsh|cmd).*")))
  [
    (recipe
      (recipe_body
        !shebang) @injection.content
      (#set! injection.include-children))

    (assignment
      (expression
        (value
          (external_command
            (command_body) @injection.content))))
  ])

; ================ Script interpreter specified ================

(source_file
  (setting
    left: (identifier) @_setting_name
    element: (string (string_content) @_lang
      (#match? @_lang ".*(powershell|pwsh|cmd).*")
      (#eq? @_setting_name "script-interpreter")
      (#set! injection.language "powershell")))
  (recipe
    (attribute
      (identifier) @_attr
      (#eq? @_attr "script"))
    (recipe_body) @injection.content
    (#set! injection.include-children)))

(source_file
  (setting
    left: (identifier) @_setting_name
    element: (string (string_content) @injection.language
      (#not-match? @injection.language ".*(powershell|pwsh|cmd).*")
      (#eq? @_setting_name "script-interpreter")))
  (recipe
    (attribute
      (identifier) @_attr
      (#eq? @_attr "script"))
    (recipe_body) @injection.content
    (#set! injection.include-children)))

; ================ Recipe language specified ================                           ; SKIP-HELIX
                                                                                        ; SKIP-HELIX
; Set highlighting for recipes that specify a language, using the exact name by default ; SKIP-HELIX
(recipe_body ;                                                                          ; SKIP-HELIX
  (shebang ;                                                                            ; SKIP-HELIX
    (language) @injection.language)                                                     ; SKIP-HELIX
  (#not-any-of? @injection.language "python3" "nodejs" "node" "uv")                     ; SKIP-HELIX
  (#set! injection.include-children)) @injection.content                                ; SKIP-HELIX
                                                                                        ; SKIP-HELIX
; Transform some known executables                                                      ; SKIP-HELIX
                                                                                        ; SKIP-HELIX
; python3/uv -> python                                                                  ; SKIP-HELIX
(recipe_body                                                                            ; SKIP-HELIX
  (shebang                                                                              ; SKIP-HELIX
    (language) @_lang)                                                                  ; SKIP-HELIX
  (#any-of? @_lang "python3" "uv")                                                      ; SKIP-HELIX
  (#set! injection.language "python")                                                   ; SKIP-HELIX
  (#set! injection.include-children)) @injection.content                                ; SKIP-HELIX
                                                                                        ; SKIP-HELIX
; node/nodejs -> javascript                                                             ; SKIP-HELIX
(recipe_body                                                                            ; SKIP-HELIX
  (shebang                                                                              ; SKIP-HELIX
    (language) @_lang)                                                                  ; SKIP-HELIX
  (#any-of? @_lang "node" "nodejs")                                                     ; SKIP-HELIX
  (#set! injection.language "javascript")                                               ; SKIP-HELIX
  (#set! injection.include-children)) @injection.content                                ; SKIP-HELIX

; ================ Recipe language specified - Helix only ================              ; SKIP-NVIM SKIP-NVIM-OLD SKIP-LAPCE SKIP-ZED
                                                                                        ; SKIP-NVIM SKIP-NVIM-OLD SKIP-LAPCE SKIP-ZED
; Set highlighting for recipes that specify a language using builtin shebang matching   ; SKIP-NVIM SKIP-NVIM-OLD SKIP-LAPCE SKIP-ZED
(recipe_body                                                                            ; SKIP-NVIM SKIP-NVIM-OLD SKIP-LAPCE SKIP-ZED
  (shebang) @injection.shebang                                                          ; SKIP-NVIM SKIP-NVIM-OLD SKIP-LAPCE SKIP-ZED
  (#set! injection.include-children)) @injection.content                                ; SKIP-NVIM SKIP-NVIM-OLD SKIP-LAPCE SKIP-ZED
