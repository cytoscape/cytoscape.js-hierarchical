;(function(){ 'use strict';

  // Implemented from the reference library: https://harthur.github.io/clusterfck/

  var defaults = {
    distance: 'euclidean',
    linkage: 'single',
    threshold: 10,
    mode: 'regular',
    cutoff: 0,
    attributes: [
      function(node) {
        return node.position('x');
      },
      function(node) {
        return node.position('y');
      }
    ],
    testMode: false
  };

  var setOptions = function( opts, options ) {
    for (var i in defaults) { opts[i] = defaults[i]; }
    for (var i in options)  { opts[i] = options[i];  }
  };

  var distances = {
    euclidean: function ( n1, n2, attributes ) {
      var total = 0;
      for ( var dim = 0; dim < attributes.length; dim++ ) {
        total += Math.pow( attributes[dim](n1) - attributes[dim](n2), 2 );
      }
      return Math.sqrt(total);
    },
    manhattan: function ( n1, n2, attributes ) {
      var total = 0;
      for ( var dim = 0; dim < attributes.length; dim++ ) {
        total += Math.abs( attributes[dim](n1) - attributes[dim](n2) );
      }
      return total;
    },
    max: function ( n1, n2, attributes ) {
      var max = 0;
      for ( var dim = 0; dim < attributes.length; dim++ ) {
        max = Math.max( max, Math.abs( attributes[dim](n1) - attributes[dim](n2) ) );
      }
      return max;
    }
  };

  var mergeClosest = function( clusters, index, dists, mins, opts ) {
    // Find two closest clusters from cached mins
    var minKey = 0;
    var min = Infinity;

    for ( var i = 0; i < clusters.length; i++ ) {
      var key  = clusters[i].key;
      var dist = dists[key][mins[key]];
      if ( dist < min ) {
        minKey = key;
        min = dist;
      }
    }
    if ( (opts.mode === 'regular'    && min >= opts.threshold) ||
         (opts.mode === 'dendrogram' && clusters.length === 1) ) {
      return false;
    }

    var c1 = index[minKey];
    var c2 = index[mins[minKey]];

    // Merge two closest clusters
    if ( opts.mode === 'dendrogram' ) {
      var merged = {
        left: c1,
        right: c2,
        key: c1.key
      };
    }
    else {
      var merged = {
        value: c1.value.concat(c2.value),
        key: c1.key
      };
    }

    clusters[c1.index] = merged;
    clusters.splice(c2.index, 1);

    index[c1.key] = merged;

    // Update distances with new merged cluster
    for ( var i = 0; i < clusters.length; i++ ) {
      var cur = clusters[i];

      if ( c1.key === cur.key ) {
        dist = Infinity;
      }
      else if ( opts.linkage === 'single' ) {
        dist = dists[c1.key][cur.key];
        if ( dists[c1.key][cur.key] > dists[c2.key][cur.key] ) {
          dist = dists[c2.key][cur.key];
        }
      }
      else if ( opts.linkage === 'complete' ) {
        dist = dists[c1.key][cur.key];
        if ( dists[c1.key][cur.key] < dists[c2.key][cur.key] ) {
          dist = dists[c2.key][cur.key];
        }
      }
      else if ( opts.linkage === 'average' ) {
        dist = (dists[c1.key][cur.key] * c1.size + dists[c2.key][cur.key] * c2.size) / (c1.size + c2.size);
      }
      else {
        if ( opts.mode === 'dendrogram' )
          dist = distances[opts.distance]( cur.value, c1.value, opts.attributes );
        else
          dist = distances[opts.distance]( cur.value[0], c1.value[0], opts.attributes );
      }

      dists[c1.key][cur.key] = dists[cur.key][c1.key] = dist; // distance matrix is symmetric
    }

    // Update cached mins
    for ( var i = 0; i < clusters.length; i++ ) {
      var key1 = clusters[i].key;
      if ( mins[key1] === c1.key || mins[key1] === c2.key ) {
        var min = key1;
        for ( var j = 0; j < clusters.length; j++ ) {
          var key2 = clusters[j].key;
          if ( dists[key1][key2] < dists[key1][min] ) {
            min = key2;
          }
        }
        mins[key1] = min;
      }
      clusters[i].index = i;
    }

    // Clean up meta data used for clustering
    delete c1.key; delete c2.key;
    delete c1.index; delete c2.index;

    return true;
  };

  var getAllChildren = function( root, arr, cy ) {

    if ( !root )
        return;

    if ( root.value ) {
      arr.push( root.value );
    }
    else {
      if ( root.left )
        getAllChildren( root.left, arr, cy );
      if ( root.right )
        getAllChildren( root.right, arr, cy );
    }
  };

  var buildDendrogram = function ( root, cy ) {

    if ( !root )
        return '';

    if ( root.left && root.right ) {

      var leftStr = buildDendrogram( root.left, cy );
      var rightStr = buildDendrogram( root.right, cy );

      var node = cy.add({group:'nodes', data: {id: leftStr + ',' + rightStr}});

      cy.add({group:'edges', data: { source: leftStr, target: node.id() }});
      cy.add({group:'edges', data: { source: rightStr, target: node.id() }});

      return node.id();
    }
    else if ( root.value ) {
      return root.value.id();
    }

  };

  var buildClustersFromTree = function( root, k, cy ) {

    if ( !root )
        return [];

    var left = [], right = [], leaves = [];

    if ( k === 0 ) { // don't cut tree, simply return all nodes as 1 single cluster
      if ( root.left )
        getAllChildren( root.left, left, cy );
      if ( root.right )
        getAllChildren( root.right, right, cy );

      leaves = left.concat(right);
      return [ cy.collection(leaves) ];
    }
    else if ( k === 1 ) { // cut at root

      if ( root.value ) { // leaf node
        return [ cy.collection( root.value ) ];
      }
      else {
        if ( root.left )
          getAllChildren( root.left, left, cy );
        if ( root.right )
          getAllChildren( root.right, right, cy );

        return [ cy.collection(left), cy.collection(right) ];
      }
    }
    else {
      if ( root.value ) {
        return [ cy.collection(root.value) ];
      }
      else {
        if ( root.left )
          left  = buildClustersFromTree( root.left, k - 1, cy );
        if ( root.right )
          right = buildClustersFromTree( root.right, k - 1, cy );

        return left.concat(right);
      }
    }
  };

  var printMatrix = function( M ) { // used for debugging purposes only
    var n = M.length;
    for(var i = 0; i < n; i++ ) {
      var row = '';
      for ( var j = 0; j < n; j++ ) {
        row += Math.round(M[i][j]*100)/100 + ' ';
      }
      console.log(row);
    }
    console.log('');
  };

  var hierarchical = function( options ){
    var cy    = this.cy();
    var nodes = this.nodes();
    var opts  = {};

    // Set parameters of algorithm: linkage type, distance metric, etc.
    setOptions( opts, options );

    // Begin hierarchical algorithm
    var clusters = [];
    var dists    = [];  // distances between each pair of clusters
    var mins     = [];  // closest cluster for each cluster
    var index    = [];  // hash of all clusters by key

    // In agglomerative (bottom-up) clustering, each node starts as its own cluster
    for ( var n = 0; n < nodes.length; n++ ) {
      var cluster = {
        value: (opts.mode === 'dendrogram') ? nodes[n] : [ nodes[n] ],
        key:   n,
        index: n
      };
      clusters[n] = cluster;
      index[n]    = cluster;
      dists[n]    = [];
      mins[n]     = 0;
    }

    // Calculate the distance between each pair of clusters
    for ( var i = 0; i < clusters.length; i++ ) {
      for ( var j = 0; j <= i; j++ ) {
        if ( opts.mode === 'dendrogram' ) // modes store cluster values differently
          var dist = (i === j) ? Infinity : distances[opts.distance]( clusters[i].value, clusters[j].value, opts.attributes );
        else
          var dist = (i === j) ? Infinity : distances[opts.distance]( clusters[i].value[0], clusters[j].value[0], opts.attributes );
        dists[i][j] = dist;
        dists[j][i] = dist;

        if ( dist < dists[i][mins[i]] ) {
          mins[i] = j;  // Cache mins: closest cluster to cluster i is cluster j
        }
      }
    }

    // Find the closest pair of clusters and merge them into a single cluster.
    // Update distances between new cluster and each of the old clusters, and loop until threshold reached.
    var merged = mergeClosest( clusters, index, dists, mins, opts );
    while ( merged ) {
      merged = mergeClosest( clusters, index, dists, mins, opts );
    }

    // Dendrogram mode builds the hierarchy and adds intermediary nodes + edges
    // in addition to returning the clusters.
    if ( opts.mode === 'dendrogram') {
      var retClusters = buildClustersFromTree( clusters[0], opts.cutoff, cy );

      if ( !opts.testMode )
        buildDendrogram( clusters[0], cy );
    }
    else { // Regular mode simply returns the clusters

      var retClusters = new Array(clusters.length);
      clusters.forEach( function( cluster, i ) {
        // Clean up meta data used for clustering
        delete cluster.key;
        delete cluster.index;

        retClusters[i] = cy.collection( cluster.value );
      });
    }

    return retClusters;
  };

  // registers the extension on a cytoscape lib ref
  var register = function( cytoscape ){

    if( !cytoscape ){ return; } // can't register if cytoscape unspecified

    // main entry point
    cytoscape( 'collection', 'hierarchical', hierarchical );

  };

  if( typeof module !== 'undefined' && module.exports ){ // expose as a commonjs module
    module.exports = register;
  }

  if( typeof define !== 'undefined' && define.amd ){ // expose as an amd/requirejs module
    define('cytoscape-hierarchical', function(){
      return register;
    });
  }

  if( typeof cytoscape !== 'undefined' ){ // expose to global cytoscape (i.e. window.cytoscape)
    register( cytoscape );
  }

})();
