const PouchDB = require('pouchdb');
const express = require('express');
const app = express();

app.use('/db', require('express-pouchdb')(PouchDB));

// TODO: make storage location customizable--or in runtime directory
let hexastore = new PouchDB('db/hexastore');

let ddoc = {
   "_id": "_design/hexastore",
   "_rev": "1-ea76c263e486c72abff5282c15de6c5a",
   "language": "javascript",
   "views": {
     "hex": {
       "map": "function(doc) {\n  if ('@graph' in doc) {\n    doc['@graph'].forEach(function(graph) {\n      Object.keys(graph).forEach(function(p) {\n        // skip JSON-LD keywords\n        if (p[0] !== '@') {\n          graph[p].forEach(function(obj) {\n            var s = graph['@id'];\n            var o = false;\n            // TODO: create b-node for missing `graph['@id']`\n            if ('@id' in obj) {\n              o = obj['@id'];\n            } else if ('@value' in obj && '@language' in obj) {\n              o = '\"' + obj['@value'] + '\"@' + obj['@language'];\n            } else if ('@value' in obj) {\n              o = '\"' + obj['@value'] + '\"';\n            }\n            if (o) {\n              emit(['spo', s, p, o], 1);\n              emit(['sop', s, o, p], 1);\n              emit(['pos', p, o, s], 1);\n              emit(['pso', p, s, o], 1);\n              emit(['ops', o, p, s], 1);\n              emit(['osp', o, s, p], 1);\n            }\n          });\n        }\n      });\n    });\n  }\n}"
   }
 }
};

hexastore.put(ddoc).then(function() {
  console.log('ddoc put');
}).catch((err) => {
  // TODO: make this a "force" update...instead of never being able to update...
  if (err.status !== 409) {
    console.error(err);
  }
});

let doc = {
   "_id": "c6edca6047852f6e4ca1b2f5990007e8",
   "@graph": [
       {
           "@id": "http://example.com/jane",
           "@type": [
               "http://schema.org/Person"
           ],
           "http://schema.org/jobTitle": [
               {
                   "@value": "Professor",
                   "@language": "en"
               },
               {
                   "@value": "Teacher",
                   "@language": "en"
               }
           ],
           "http://schema.org/name": [
               {
                   "@value": "Jane Doe"
               }
           ],
           "http://schema.org/telephone": [
               {
                   "@value": "(425) 123-4567"
               }
           ],
           "http://schema.org/url": [
               {
                   "@id": "http://www.janedoe.com"
               }
           ]
       }
   ]
};

hexastore.put(doc).then((resp) => {
  console.log(resp);
}).catch(console.error);

app.get('/', (req, res) => {
  let s = req.query.s || false;
  let p = req.query.p || false;
  let o = req.query.o || false;

  let output = '';

  let key = [];
  if (s && !p && !o) {
    key = ['spo', s];
  } else if (!s && p && !o) {
    key = ['pos', p];
  } else if (!s && !p && o) {
    key = ['osp', o];
  } else if (s && p && !o) {
    key = ['spo', s, p];
  } else if (s && !p && o) {
    key = ['sop', s, o];
  } else if (!s && p && o) {
    key = ['pos', p, o];
  }

  // TODO: objects may contain an `@language` suffix, so we reach past that

  if (key.length > 0) {
    hexastore.query('hexastore/hex', {
      start_key: key,
      end_key: key.concat({})
    }).then((results) => {
      if ('rows' in results && results.rows.length > 0) {
        let order = key[0].split('');
        res.format({
          'text/turtle'() {
            results.rows.forEach((row) => {
              output += `<${row.key[order.indexOf('s')+1]}> <${row.key[order.indexOf('p')+1]}> ${row.key[order.indexOf('o')+1]} .\n`;
            });
            res.send(output);
          }
        });
      }
    }).catch(console.error);
  } else {
    // throw something...
  }
});

app.listen(3000, () => console.log('listening on port 3000'));
