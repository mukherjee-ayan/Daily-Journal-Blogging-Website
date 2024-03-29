//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const _ = require("lodash");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const homeStartingContent = "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";

const aboutContent = "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis purus sit. Egestas sed sed risus pretium quam vulputate dignissim suspendisse. Mauris in aliquam sem fringilla. Semper risus in hendrerit gravida rutrum quisque non tellus orci. Amet massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";

const contactContent = "Scelerisque eleifend donec pretium vulputate sapien. Rhoncus urna neque viverra justo nec ultrices. Arcu dui vivamus arcu felis bibendum. Consectetur adipiscing elit duis tristique. Risus viverra adipiscing at in tellus integer feugiat. Sapien nec sagittis aliquam malesuada bibendum arcu vitae. Consequat interdum varius sit amet mattis. Iaculis nunc sed augue lacus. Interdum posuere lorem ipsum dolor sit amet consectetur adipiscing elit. Pulvinar elementum integer enim neque. Ultrices gravida dictum fusce ut placerat orci nulla. Mauris in aliquam sem fringilla ut morbi tincidunt. Tortor posuere ac ut consequat semper viverra nam libero.";

var redirectTo = "/";

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const username = encodeURIComponent(process.env.DB_USER);
const password = encodeURIComponent(process.env.DB_PASS);

mongoose.connect("mongodb+srv://"+ username + ":" + password + "@cluster0.frp4d.mongodb.net/?retryWrites=true&w=majority");

/*
const blogSchema = new mongoose.Schema({
  title: String,
  content: String
});
const Blog = mongoose.model("Blog", blogSchema);
*/

const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  password: String,
  blogs: [{
    title: String,
    content: String,
    dateOfCreation: Date
  }]
});
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  if (!["/login", "/register"].includes(req.originalUrl)) {
    redirectTo = req.originalUrl;
  }
  next();
});

app.get("/", function(req, res){
  /*
  Blog.find(function(err, posts){
    if (err) {
      console.log(err);
    } else {
      res.render("home",{startingContent: homeStartingContent, posts: posts});
    }
  });
*/

  function compare(a, b) {
    if (a.dateOfCreation < b.dateOfCreation) {
      return 1;
    } else if (a.dateOfCreation > b.dateOfCreation) {
      return -1;
    }
    return 0;
  }

  User.find(function(err, users) {
    if (err) {
      console.log(err);
    } else {
      const posts = [];
      users.forEach(function(user){
        user.blogs.forEach(function(blog){
          posts.push({
            userId: user._id,
            author: user.name,
            blogId: blog._id,
            title: blog.title,
            content: blog.content,
            dateOfCreation: blog.dateOfCreation
          });
        });
      });
      posts.sort(compare);
      res.render("home", {headerType: req.isAuthenticated(), startingContent: homeStartingContent, posts: posts});
    }
  });
});

app.get("/about", function(req, res){
  res.render("info", {headerType: req.isAuthenticated(), pageTitle: "About", content: aboutContent});
});

app.get("/contact", function(req, res){
  res.render("info", {headerType: req.isAuthenticated(), pageTitle: "Contact", content: contactContent});
});

app.get("/compose", function(req, res){
  if (req.isAuthenticated()) {
    res.render("compose", {headerType: req.isAuthenticated()});
  } else {
    res.redirect("/login");
  }
});

app.get("/account", function(req, res){
  if (req.isAuthenticated()) {
    User.findOne({_id: req.user._id}, function(err, foundUser){
      res.render("account", {headerType: true, user: foundUser})
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/posts/:userId/:title", function(req, res){
  // console.log(search(req.params.title));
  const requestedTitle = _.lowerCase(req.params.title);//lodash used
  const requestedUserId = req.params.userId;
  // const requestedBlogId = req.params.blogId;

  User.findOne({_id: requestedUserId}, function(err, user){
    const post = user.blogs.filter(function(blog){
      return _.lowerCase(blog.title) === requestedTitle;
    });
    res.render("post", {headerType: req.isAuthenticated(), post: post[0], author: user.name});
  });
});

app.get("/delete/:titleId", function(req, res){
  if (req.isAuthenticated()) {
    User.updateOne(
      {_id: req.user._id},
      {$pull: {blogs: {_id: mongoose.Types.ObjectId(req.params.titleId)}}}, //String to ObjectId
      function(err){
        if (err) {
          console.log(err);
        } else {
          res.redirect("/account");
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

app.get("/edit/:titleId", function(req, res){
  if (req.isAuthenticated()) {
    User.findOne(
      {_id: req.user._id},
      {blogs: {$elemMatch: {_id: mongoose.Types.ObjectId(req.params.titleId)}}},
      function(err, foundData){
        if (err) {
          console.log(err);
        } else {
          const post = foundData.blogs[0];
          res.render("edit", {headerType: true, post: post});
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

app.post("/edit/:titleId", function(req, res){
  if (req.isAuthenticated()) {
    const titleId = mongoose.Types.ObjectId(req.params.titleId);
    if (req.body.postTitle && req.body.postBody) {
      User.updateOne(
        {_id: req.user._id, blogs: {$elemMatch: {_id: titleId}}},
        {$set: {
          "blogs.$.title": req.body.postTitle,
          "blogs.$.content": req.body.postBody,
          "blogs.$.dateOfCreation": new Date()
        }},
        function(err){
          if (err) {
            console.log(err);
          } else {
            res.redirect("/account");
          }
        }
      );
    } else {
      res.redirect("/edit/" + titleId);
    }
  } else {
    res.redirect("/login");
  }
});

app.post("/compose", function(req, res){
  /*
  const post = new Blog({title: req.body.postTitle, content: req.body.postBody});
  console.log(req.user);
  post.save(function(err){
    if (!err) {
      res.redirect("/");
    }
  });
*/

  if (req.isAuthenticated()) {
    if (req.body.postTitle && req.body.postBody) {
      User.findById(req.user._id, function(err, foundUser){
        if (err) {
          console.log(err);
        } else {
          const post = {
            title: req.body.postTitle,
            content: req.body.postBody,
            dateOfCreation: new Date()
          };
          foundUser.blogs.push(post);
          foundUser.save(function(err){
            if (err) {
              console.log(err);
            } else {
              res.redirect("/");
            }
          });
        }
      });
    } else {
      res.redirect("/compose");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/login", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/");
  } else {
    res.render("enter", {headerType: false, pageName: "Login"});
  }
});

app.get("/register", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/");
  } else {
    res.render("enter", {headerType: false, pageName: "Register"});
  }
});

/*
app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/compose");
      });
    }
  });
});
*/

app.post("/login",
  passport.authenticate("local", {failureRedirect: "/login", failureMessage: true }),
  function(req, res) {
    res.redirect(redirectTo);
  });

app.get("/logout", function(req, res) {
  req.logout(function(err){
    if (err) {
      console.log(err);
    } else {
      res.redirect("back"); // Back to the route from where get method is called.
    }
  });
});

app.post("/register", function(req, res) {
  User.register({name: req.body.name, username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect(redirectTo);
      });
    }
  });
});

app.listen(process.env.PORT || 3000, function() {
  console.log("Server is running");
});

/*
function search(key) {
  for (var i = 0; i < posts.length; i++) {
    if(posts[i].title === key){
      return "Match found!";
    }
  }
  return "Match not found!";
}
*/
