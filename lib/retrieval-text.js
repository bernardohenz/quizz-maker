function retrievalText(item) {
  const source = item && typeof item === 'object' ? item : {};
  const tags = Array.isArray(source.skill_tags)
    ? source.skill_tags.filter((tag) => typeof tag === 'string' && tag.trim() !== '').join(', ')
    : '';
  return [
    source.skill ? `Habilidade: ${source.skill}` : '',
    tags ? `Etiquetas: ${tags}` : '',
    source.stem || '',
  ].filter((line) => String(line).trim() !== '').join('\n');
}

module.exports = { retrievalText };
