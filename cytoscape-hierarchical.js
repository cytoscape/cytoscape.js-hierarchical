;(function(){ 'use strict';

  // Implemented from the reference library: https://harthur.github.io/clusterfck/

  var defaults = {
    distance: 'euclidean',
    linkage: 'single',
    threshold: 10,
    attributes: [
      function(node) {
        return node.position('x');
      },
      function(node) {
        return node.position('y');
      }
    ]
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
    if ( min >= opts.threshold ) {
      return false;
    }

    var c1 = index[minKey];
    var c2 = index[mins[minKey]];

    // Merge two closest clusters
    var merged = {
      value: c1.value.concat(c2.value),
      key: c1.key
    };

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

  var hierarchical = function( options ){
    var cy    = this.cy();
    var nodes = this.nodes();
    var edges = this.edges();
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
        value: [ nodes[n] ],
        key:   n,
        index: n
      };
      clusters[n] = cluster;
      index[n]    = cluster;
      dists[n]    = [];
      mins[n]     = 0;
    }

    // Initialize and calculate the distance between each pair of clusters
    for ( var i = 0; i < clusters.length; i++ ) {
      for ( var j = 0; j <= i; j++ ) {
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
    var merged = mergeClosest( clusters, index, dists, mins, opts, edges, cy );
    while ( merged ) {
      merged = mergeClosest( clusters, index, dists, mins, opts, edges, cy );
    }

    var retClusters = new Array(clusters.length);
    clusters.forEach( function( cluster, i ) {
      // Clean up meta data used for clustering
      delete cluster.key;
      delete cluster.index;

      retClusters[i] = cy.collection( cluster.value );
    });

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
