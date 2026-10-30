'use strict';

/**
 * Cache busting: every build stamps the site's own scripts and stylesheets
 * with ?v=<build>, so a browser (or the CDN in front of GitHub Pages) that
 * kept last deploy's /js/*.js picks up the new one on the next visit.
 */

const version = Date.now().toString(36);
const ASSET = /((?:src|href)="\/(?:js|css)\/[^"?]+\.(?:js|css)|href="\/fonts\/display\.css)"/g;

hexo.extend.filter.register('after_render:html', html => html.replace(ASSET, `$1?v=${version}"`));
