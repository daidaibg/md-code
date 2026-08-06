import type * as Monaco from 'monaco-editor';

interface NginxLanguageGlobal {
  __mdCodeNginxLanguageRegistered?: boolean;
}

const nginxLanguageGlobal = globalThis as typeof globalThis & NginxLanguageGlobal;

export function registerNginxLanguage(monaco: typeof Monaco): void {
  if (nginxLanguageGlobal.__mdCodeNginxLanguageRegistered) return;

  if (!monaco.languages.getLanguages().some((language) => language.id === 'nginx')) {
    monaco.languages.register({
      id: 'nginx',
      aliases: ['Nginx', 'nginx'],
      extensions: ['.conf', '.con'],
      filenames: ['nginx.conf']
    });
  }

  monaco.languages.setLanguageConfiguration('nginx', {
    comments: { lineComment: '#' },
    brackets: [
      ['{', '}'],
      ['(', ')'],
      ['[', ']']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  });

  monaco.languages.setMonarchTokensProvider('nginx', {
    defaultToken: '',
    tokenPostfix: '.nginx',
    tokenizer: {
      root: [
        [/^(\s*)([a-z_][\w-]*)/iu, ['', 'keyword']],
        [/#.*$/u, 'comment'],
        [/\$\{[a-z_][\w]*\}/iu, 'variable'],
        [/\$[a-z_][\w]*/iu, 'variable'],
        [/"/u, 'string.quote', '@doubleQuotedString'],
        [/'/u, 'string.quote', '@singleQuotedString'],
        [/\b(?:on|off|true|false|yes|no)\b/iu, 'constant.language'],
        [/\b(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS|CONNECT|TRACE)\b/u, 'type.identifier'],
        [/\b(?:http|https|http2|ssl|tlsv1(?:\.[0-3])?|udp|tcp)\b/iu, 'type.identifier'],
        [/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/u, 'number'],
        [/\b\d+(?:\.\d+)?(?:ms|s|m|h|d|w|k|m|g)?\b/iu, 'number'],
        [/(?:~\*?|=|\^~|!~\*?)/u, 'operator'],
        [/[{}()[\]]/u, '@brackets'],
        [/;/u, 'delimiter'],
        [/\s+/u, 'white'],
        [/[a-z_][\w-]*/iu, 'identifier']
      ],
      doubleQuotedString: [
        [/[^\\"$]+/u, 'string'],
        [/\\./u, 'string.escape'],
        [/\$\{[a-z_][\w]*\}/iu, 'variable'],
        [/\$[a-z_][\w]*/iu, 'variable'],
        [/"/u, 'string.quote', '@pop']
      ],
      singleQuotedString: [
        [/[^\\']+/u, 'string'],
        [/\\./u, 'string.escape'],
        [/'/u, 'string.quote', '@pop']
      ]
    }
  });

  nginxLanguageGlobal.__mdCodeNginxLanguageRegistered = true;
}
