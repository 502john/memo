/**
 * dom.js: the one helper every component is built with.
 *
 *   el('button', { class: 'primary', onclick: save }, 'Save')
 *   → <button class="primary">Save</button>, with a click listener
 *
 * Props that start with "on" become event listeners. Props or children that
 * are null, undefined or false are skipped, so `isEditing && el(...)` works.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [name, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value === true ? '' : value);
  }

  node.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  return node;
}

/** classes('word', isCurrent && 'current') → "word current" or "word" */
export function classes(...names) {
  return names.filter(Boolean).join(' ');
}
