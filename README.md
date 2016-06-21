cytoscape-hierarchical
================================================================================

![Screenshot of clusters returned from hierarchical clustering algorithm](./demo-img.png?raw=true "Screenshot of clusters returned from hierarchical clustering algorithm")

A Cytoscape.js extension for the hierarchical clustering algorithm


## Dependencies

 * Cytoscape.js >= 2.6.12


## Usage instructions

Download the library:
 * via npm: `npm install cytoscape-hierarchical`,
 * via bower: `bower install cytoscape-hierarchical`, or
 * via direct download in the repository (probably from a tag).

`require()` the library as appropriate for your project:

CommonJS:
```js
var cytoscape = require('cytoscape');
var hierarchical = require('cytoscape-hierarchical');

hierarchical( cytoscape ); // register extension
```

AMD:
```js
require(['cytoscape', 'cytoscape-hierarchical'], function( cytoscape, hierarchical ){
  hierarchical( cytoscape ); // register extension
});
```

Plain HTML/JS has the extension registered for you automatically, because no `require()` is needed.


## API

Please briefly describe your API here:

```js
cy.hierarchical({
  foo: 'bar', // some option that does this
  baz: 'bat' // some options that does that
  // ... and so on
});
```

Or maybe if you have a collection extension:

```js
cy.elements().test({
  foo: 'bar', // some option that does this
  baz: 'bat' // some options that does that
  // ... and so on
});
```


## Publishing instructions

This project is set up to automatically be published to npm and bower.  To publish:

1. Set the version number environment variable: `export VERSION=1.2.3`
1. Publish: `gulp publish`
1. If publishing to bower for the first time, you'll need to run `bower register cytoscape-hierarchical https://github.com/cytoscape.js-hierarchical.git`
