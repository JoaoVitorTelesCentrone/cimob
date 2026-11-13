/**
 * O que a página usa nos controles do espelho (hora do sol e vistas) sem carregar o three.js:
 * o 3D vem depois, por `next/dynamic`.
 */
export { brasiliaNow, dateAtHour } from "./sun";
export { VIEW_NAMES, type ViewName, type ViewRequest } from "./views";
