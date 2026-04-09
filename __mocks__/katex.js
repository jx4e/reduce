// Jest stub for katex
module.exports = {
  renderToString: (content) => `<span class="katex-mock">${content}</span>`,
}
