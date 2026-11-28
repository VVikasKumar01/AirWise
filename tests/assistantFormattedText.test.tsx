import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantFormattedText } from '../src/components/AssistantFormattedText.tsx';

test('assistant formatter groups bullets, strips markdown, and escapes HTML', () => {
  const html = renderToStaticMarkup(
    createElement(AssistantFormattedText, {
      text: '## Today\n- **Use** a purifier\n- Open windows later\n---\n<script>alert(1)</script>',
    }),
  );

  assert.equal((html.match(/<li>/g) || []).length, 2);
  assert.match(html, /Today/);
  assert.match(html, /Use a purifier/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
