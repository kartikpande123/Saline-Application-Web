const express = require('express');
const path = require('path');
const axios = require('axios');
const { log } = require('console');
const dirPath = path.join(__dirname, "public");
console.log(dirPath);
const app = express();
const port = 3500;

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({extended:true}));


app.get("/", (req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
})


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
