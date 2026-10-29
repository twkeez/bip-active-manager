// Which addresses are service pages. Sites put them under /services/, but also
// /veterinary-services/, /pet-services/, /our-services/ (Edgewater, Oct 2026:
// all eight under /veterinary-services/ were missed, so it scored 0 for
// services and got no service questions).

/** A page under a services folder; group 2 is the page's own slug. */
export const SERVICE_PATH = /\/([a-z]+-)*(services?|treatments?)\/([^/]+?)(?:\.html?)?\/?$/i;

/** Google's article labels: a post outside /blog/ still says it's one. */
export const ARTICLE_SCHEMA = /^(BlogPosting|Article|NewsArticle)$/;
