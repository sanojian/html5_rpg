var fs = require('fs');
fs.readFile('river.json', 'ascii', function(err,data){
  if(err) {
    console.error("Could not open file: %s", err);
    process.exit(1);
  }
  var mapData = JSON.parse(data);
  console.log(mapData.height);
});
