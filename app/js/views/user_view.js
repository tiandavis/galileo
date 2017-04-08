/* Copyright (c) 2011 Tian Valdemar Davis and TechOctave, LLC
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
window.TweetList = new Tweets();
window.UserList = new Users();
window.FilteredUsers = new Users();

window.startService = function() {
	var pollInterval = Math.floor((Math.random() * 10) + 2); //Random number between ( + X) and ( * Y)

	//Get the next User in the Todo
	var todo = store.findAll("todos").pop(); //Could be empty on the first run (that's just fine!)

	if (typeof todo !== "undefined" && todo !== null) {
		//Get OAuth Credentials
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
			consumerKey: app_credentials.consumer_key,
			consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
			accessTokenSecret: user_credentials.oauth_token_secret
	  });

		//Follow or Unfollow the User based on action attribute
		if(todo.action === "follow" && window.appView.follows() < window.appView.MAX_FOLLOWS) {
			//Follow
			oauth.post("https://api.twitter.com/1.1/friendships/create.json", {user_id: todo.id}, function (data) {
				//Remove User from Todo table
				store.destroy("todos", todo);

				//Add the user just followed to Followed table
				var followed = {
					"id": JSON.parse(data.text).id,
					"timestamp": Math.round(Date.now()/1000)
				};

				store.create("followed", followed);

				//Add the user to the friends table
				var friend = {
					"id": todo.id.toString()
				};

				store.create("friends", friend);

				//Update Follows Limit
				window.appView.follows();

				//Update queue text
				$("#todo").text("TODO: " + store.findAll("todos").length + ":" + pollInterval);
			}, function(error) {
				var errors = JSON.parse(error.text).errors;

				_.each(errors, function(error) {
					//You have been blocked from following this account at the request of the user.
					if(error.code === 162) {
						//Remove User from Todo table
						store.destroy("todos", todo);

						//Add the user to the Haters table
						var hater = {
							"id": todo.id.toString()
						};

						store.create("haters", hater);

						//Remove User from Friends table
						store.destroy("friends", hater);
					}

					//Cannot find specified user.
					if(error.code === 108) {
						//Remove User from Todo table
						store.destroy("todos", todo);

						//Add the User to the Ignore table
						var ignore = {
							"id": todo.id.toString()
						};

						store.create("ignorelist", ignore);
					}
				});

				//Update queue text
				$("#todo").text("TODO: " + store.findAll("todos").length + ":" + pollInterval);
		  });
		}

		if(todo.action === "unfollow" && window.appView.unfollows() < window.appView.MAX_UNFOLLOWS) {
			oauth.post("https://api.twitter.com/1.1/friendships/destroy.json", {user_id: todo.id}, function (data) {
				//Remove User from Todo table
				store.destroy("todos", todo);

				//Add the user just unfollowed to Unfollowed table
				var unfollowed = {
					"id": JSON.parse(data.text).id,
					"timestamp": Math.round(Date.now()/1000)
				};

				store.create("unfollowed", unfollowed);

				//Remove the user from the friends table
				var friend = {
					"id": todo.id.toString()
				};

				store.destroy("friends", friend);

				//Update UnFollows Limit
				window.appView.unfollows();

				//Update queue text
				$("#todo").text("TODO: " + store.findAll("todos").length + ":" + pollInterval);
		  });
		}
	}

	//Update queue text
	$("#todo").text("TODO: " + store.findAll("todos").length + ":" + pollInterval);

	//Setup the next service run
 	window.setTimeout(startService, (1000 * pollInterval));

};//window.startService

window.onload = function() {
	//Follow or Unfollow like a human - not a bot
	window.startService();
};

var UserView = Backbone.View.extend({
	el: $(".users"), //Note "this" refers to the current view

	initialize: function() {
		//Get OAuth Credentials
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
      consumerKey: app_credentials.consumer_key,
      consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
			accessTokenSecret: user_credentials.oauth_token_secret
	  });

		//Get list of people User is following (friends)
		oauth.get("https://api.twitter.com/1.1/friends/ids.json?user_id=" + user_credentials.id, function (data) {
			//console.log("friends");

			//Empty previous friends list
			store.empty("friends");

			var ids = JSON.parse(data.text).ids;

			//Add authenticated User's friends to the friends table
			_.each(ids, function(id) {
				var friend = {
					"id": id.toString()
				};

				store.create("friends", friend);
			});

			//Update API Tokens
			window.appView.rate_limit_status("friends", "ids");
	    });

		//Get list of people who follow the User (followers)
		oauth.get("https://api.twitter.com/1.1/followers/ids.json?user_id=" + user_credentials.id, function (data) {
			//console.log("followers");

			//Empty previous followers list
			store.empty("followers");

			var ids = JSON.parse(data.text).ids;

			//Add authenticated User's followers to the followers table
			_.each(ids, function(id) {
				var follower = {
					"id": id.toString()
				};

				store.create("followers", follower);
			});

			//Update API Tokens
			window.appView.rate_limit_status("followers", "ids");
	  });
	},

	events: {
		"click .user"				: "select"
  },

	search: function(options) {
		options || (options = {});

		this.$el.empty(); //Reset the View
		window.TweetList.reset();
		window.UserList.reset();

		//Trim the search term. If empty, then return false;
		options.term = $.trim(options.term);

		if(options.term.length === 0) {
			//console.log("options.term.length: " + options.term.length);
			return false;
		}

		//window.TweetList.url = "https://search.twitter.com/search.json?callback=?&rpp=3&q=" + encodeURIComponent(options.term);
		//window.TweetList.url = "https://search.twitter.com/search.json?rpp=" + 100 + "&q=" + options.term;
		window.TweetList.url = "https://api.twitter.com/1.1/search/tweets.json?result_type=mixed&count=" + 100 + "&q=" + options.term;

		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
			consumerKey: app_credentials.consumer_key,
			consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
			accessTokenSecret: user_credentials.oauth_token_secret
	  });

		oauth.get(window.TweetList.url, function (data) {
			var search = JSON.parse(data.text);

			window.TweetList.add(search.statuses);

			//No results returned
			if(window.TweetList.length === 0) {
				//Display guidance walk-through
				return this;
			}

			//Sort and Remove Duplicate Tweets
			var results = window.TweetList.sortBy(function(tweet) {
				return tweet.get("user").screen_name.toString().toLowerCase();
			});

			window.TweetList.reset(results);

			//Now Remove Duplicates
			var removeTweets = new Tweets();

			for(var i = 1; i < window.TweetList.length; i++) {
				if(window.TweetList.models[i-1].get("user").screen_name === window.TweetList.models[i].get("user").screen_name) {
					//console.log("dupe["+i+"]: " + window.TweetList.models[i].get("user").screen_name);
					removeTweets.add(window.TweetList.models[i]);
				}
			}

			window.TweetList.remove(removeTweets.models);

			//Get list of screen_name to get details for
			var screen_name = [];

			window.TweetList.each(function(tweet){
				screen_name.push(tweet.get("user").screen_name);
			});

			//Get User details (Single-Call for upto 100 users at a time - POWERFUL!)
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?screen_name=" + screen_name.splice(0,100);

			oauth.get(window.UserList.url, function (data) {
				//Reset the list of Users
				window.UserList.reset(JSON.parse(data.text));

				window.UserList.each(function(user){
					//Make sure the important nodes are always available
					//undefined = the value of missing properties
					//null = the property exists, but the value is not known
					if (typeof user.get("name") === "undefined" || user.get("name") === null) {
						user.set({name: ""});
					}

					if (typeof user.get("screen_name") === "undefined" || user.get("screen_name") === null) {
						user.set({screen_name: ""});
					}

					if (typeof user.get("location") === "undefined" || user.get("location") === null) {
						user.set({location: ""});
					}

					if (typeof user.get("status") === "undefined" || user.get("status") === null) {
						user.set({status: {text: ""}});
					}

					if (typeof user.get("description") === "undefined" || user.get("description") === null) {
						user.set({description: ""});
					}

					//Autolink: Usernames, Urls and Hashtags
					//user.set({description: window.twttr.txt.autoLink(user.get("description"))});

					$(".users").append(_.template($("#UserTmpl").html())(user.toJSON())); //Add the User to the View

					//Add Twttr.txt to the DOM not to the Data (WORKING CODE)
					var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
					bio.html(window.twttr.txt.autoLink(bio.text()));

					//Highlight Unfollowed Users
					var unfollowlist = store.findAll("unfollowed");

					var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
						return unfollowed.id === user.get("id");
					});

					if(isUnfollowed === true) {
						var unfollowed = $("li[data-id="+ user.get("id") +"]");
						unfollowed.addClass("unfollowed");
					}
				});//window.UserList.each

				//Update API Tokens
				window.appView.rate_limit_status("search", "tweets");

				//Update Users Selected
				window.appView.users_selected();
			});//Get UserList
	  });//Get TweetList

		return this;
	},

	sort: function(options) {
		options || (options = {});

		if (typeof options.reverse === "undefined") {
			options.reverse = false;
		}

		//Empty the User list for reload
		$(".users").empty();

		//Sort on the filtered User list if a filter is being performed
		if(window.FilteredUsers.length > 0 && $("#filter").val().length > 0) {
			var results = window.FilteredUsers.sortBy(function(user){
				return options.reverse ? (-user.get(options.property)) : (user.get(options.property));
			});

			window.FilteredUsers.reset(results);

			window.FilteredUsers.each(function(user) {
				$(".users").append(_.template($("#UserTmpl").html())(user.toJSON()));

				var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
				bio.html(window.twttr.txt.autoLink(bio.text()));

				//Highlight Unfollowed Users
				var unfollowlist = store.findAll("unfollowed");

				var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
					return unfollowed.id === user.get("id");
				});

				if(isUnfollowed === true) {
					var unfollowed = $("li[data-id="+ user.get("id") +"]");
					unfollowed.addClass("unfollowed");
				}
			});

		} else {
			var results = window.UserList.sortBy(function(user) {
				return options.reverse ? (-user.get(options.property)) : (user.get(options.property));
			});

			window.UserList.reset(results);

			window.UserList.each(function(user) {
				$(".users").append(_.template($("#UserTmpl").html())(user.toJSON()));

				var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
				bio.html(window.twttr.txt.autoLink(bio.text()));

				//Highlight Unfollowed Users
				var unfollowlist = store.findAll("unfollowed");

				var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
					return unfollowed.id === user.get("id");
				});

				if(isUnfollowed === true) {
					var unfollowed = $("li[data-id="+ user.get("id") +"]");
					unfollowed.addClass("unfollowed");
				}
			});
		}

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	filter: function(options) {
		options || (options = {});

		var term = options.term;

		//No filter, so empty filteredUsers and reload original UserList.
		if(term === "") {
			$(".users").empty();
			window.UserList.each(function(user) {
				$(".users").append(_.template($("#UserTmpl").html())(user.toJSON()));

				var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
				bio.html(window.twttr.txt.autoLink(bio.text()));

				//Highlight Unfollowed Users
				var unfollowlist = store.findAll("unfollowed");

				var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
					return unfollowed.id === user.get("id");
				});

				if(isUnfollowed === true) {
					var unfollowed = $("li[data-id="+ user.get("id") +"]");
					unfollowed.addClass("unfollowed");
				}
			});

			//Update Users Selected
			window.appView.users_selected();

			return this;
		}

		//Data points of concern: name, description, screen_name, status.text || user.get("status").text)
		var results = window.UserList.filter(function(user) {
			return user.get("name").toString().toLowerCase().indexOf(term.toString().toLowerCase()) >= 0 ||
			       user.get("description").toString().toLowerCase().indexOf(term.toString().toLowerCase()) >= 0 ||
			       user.get("screen_name").toString().toLowerCase().indexOf(term.toString().toLowerCase()) >= 0 ||
			       user.get("status").text.toString().toLowerCase().indexOf(term.toString().toLowerCase()) >= 0;
		});

		window.FilteredUsers.reset(results);

		$(".users").empty();

		window.FilteredUsers.each(function(user) {
			$(".users").append(_.template($("#UserTmpl").html())(user.toJSON()));

			var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
			bio.html(window.twttr.txt.autoLink(bio.text()));

			//Highlight Unfollowed Users
			var unfollowlist = store.findAll("unfollowed");

			var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
				return unfollowed.id === user.get("id");
			});

			if(isUnfollowed === true) {
				var unfollowed = $("li[data-id="+ user.get("id") +"]");
				unfollowed.addClass("unfollowed");
			}
		});

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	select: function(event) {
		//event.currentTarget.dataset.id
		//event.currentTarget.dataset.screenName
		//You can access the element that was clicked with event.currentTarget
		//Data attributes via .dataset; data-id => id, data-screen-name => screenName

		//Get the User that was clicked on
		var user = $("li[data-id="+ event.currentTarget.dataset.id +"]");

		//Toggle the "selected" class
		user.toggleClass("selected");

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	select_all: function() {
		$(".users .user").addClass("selected");

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	remove_selected: function() {
		$(".selected").each(function(index) {
			//Remove from safelist or ignorelist if selected
			if($(this).is(".safelist") === true) {
				var user = {
					"id": $(this).data("id").toString()
				};

				store.destroy("safelist", user);
			}

			if($(this).is(".ignorelist") === true) {
				var user = {
					"id": $(this).data("id").toString()
				};

				store.destroy("ignorelist", user);
			}

			if($(this).is(".haters") === true) {
				var user = {
					"id": $(this).data("id").toString()
				};

				store.destroy("haters", user);
			}

			//Remove from DOM
			$(this).remove();

			//Remove from UserList and FilteredList (if > 0)
			window.UserList.remove( window.UserList.get( $(this).data("id") ) );

			if(window.FilteredUsers.length > 0 && $("#filter").val().length > 0) {
				window.FilteredUsers.remove( window.FilteredUsers.get( $(this).data("id") ) );
			}
		});

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	remove_unfollowed: function() {
		$(".unfollowed").each(function(index) {
			//console.log(index + ": "  + $(this).data("id"));

			//Remove from DOM
			$(this).remove();

			//Remove from UserList and FilteredList (if > 0)
			window.UserList.remove( window.UserList.get( $(this).data("id") ) );

			if(window.FilteredUsers.length > 0 && $("#filter").val().length > 0) {
				window.FilteredUsers.remove( window.FilteredUsers.get( $(this).data("id") ) );
			}
		});

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	remove_websiteless: function() {
		$(".user .statistics a.url[href='']").parents(".user").each(function(index) {
			//Remove from DOM
			$(this).remove();

			//Remove from UserList and FilteredList (if > 0)
			window.UserList.remove( window.UserList.get( $(this).data("id") ) );

			if(window.FilteredUsers.length > 0 && $("#filter").val().length > 0) {
				window.FilteredUsers.remove( window.FilteredUsers.get( $(this).data("id") ) );
			}
		});

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	remove_bioless: function() {
		$(".user .bio blockquote:empty").parents(".user").each(function(index) {
			//Remove from DOM
			$(this).remove();

			//Remove from UserList and FilteredList (if > 0)
			window.UserList.remove( window.UserList.get( $(this).data("id") ) );

			if(window.FilteredUsers.length > 0 && $("#filter").val().length > 0) {
				window.FilteredUsers.remove( window.FilteredUsers.get( $(this).data("id") ) );
			}
		});

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	add_safelist: function() {
		$(".selected").each(function(index) {
			var user = {
				"id": $(this).data("id").toString()
			};

			if(store.create("safelist", user) === true) {
				$(this).hide();
				$(this).fadeIn();
			}
		});

		return this;
	},

	add_ignorelist: function() {
		$(".selected").each(function(index){
			var user = {
				"id": $(this).data("id").toString()
			};

			if(store.create("ignorelist", user) === true) {
				$(this).hide();
				$(this).fadeIn();
			}
		});

		return this;
	},

	follow_selected: function() {
		//Add Selected Users to the Queue.
		if($(".selected").length > 0 && window.appView.follows() < window.appView.MAX_FOLLOWS) {
			//Don't add to Follow Queue:
			//1. Already following
			//2. In Ignore List
			//3. Haters
			var friends = store.findAll("friends");
			var ignorelist = store.findAll("ignorelist");
			var haters = store.findAll("haters");
			var user_credentials = store.query("credentials", "type", "user");

			$(".selected").each(function(index) {
				var id = $(this).data("id").toString(); //jQuery object alone was losing scope in Underscore

				//Query Friends list for an instance of the User
				var foundFriend = _.any(friends, function(friend) {
					return friend.id === id;
				});

				//Query Ignore list for an instance of the User
				var foundIgnore = _.any(ignorelist, function(ignore) {
					return ignore.id === id;
				});

				//Query Haters list for an instance of the User
				var foundHater = _.any(haters, function(hater) {
					return hater.id === id;
				});

				if(foundFriend === false && foundIgnore === false && foundHater === false && user_credentials.id !== id) {
					var todo = {
						"id": $(this).data("id"),
						"screen_name": $(this).data("screen-name"),
						"action": "follow"
					};

					store.create("todos", todo);

					$("#todo").text("TODO: " + store.findAll("todos").length + ":" + 0);
				}
			});
		}

		return this;
	},

	unfollow_selected: function() {
		//Add Selected Users to the Queue.
		if($(".selected").length > 0 && window.appView.unfollows() < window.appView.MAX_UNFOLLOWS) {
			//Don't add to unFollow Queue:
			//1. In Safe List
			var safelist = store.findAll("safelist");
			var user_credentials = store.query("credentials", "type", "user");

			$(".selected").each(function(index) {
				var id = $(this).data("id").toString(); //jQuery object alone was losing scope in Underscore

				//Query Safe list for an instance of the User
				var foundSafe = _.any(safelist, function(safe) {
					return safe.id === id;
				});

				//console.log("SafeList User: " + foundSafe);

				if(foundSafe === false && user_credentials.id !== id) {
					var todo = {
						"id": $(this).data("id"),
						"screen_name": $(this).data("screen-name"),
						"action": "unfollow"
					};

					store.create("todos", todo);

					$("#todo").text("TODO: " + store.findAll("todos").length + ":" + 0);
				}
			});
		}

		return this;
	},

	refresh_user_list: function() {
		window.UserList.reset();

		$(".users .user").each(function(index){
			var user = new User();
			user.set({
				"id": $(this).data("id"),
				"screen_name": $(this).data("screen-name"),
				"name": $(this).data("name"),
				"description": $(this).data("description"),
				"profile_image_url": $(this).data("profile-image-url"),
				"statuses_count": $(this).data("statuses-count"),
				"friends_count": $(this).data("friends-count"),
				"followers_count": $(this).data("followers-count"),
				"listed_count": $(this).data("listed-count"),
				"location": $(this).data("location"),
				"url": $(this).data("url"),
				"status": {text: $(this).data("status-text"), created_at: $(this).data("status-created-at")}
			});
			//console.log($(this));
			//console.log($(this).data());
			window.UserList.add(user);
		});

		//Update Users Selected
		window.appView.users_selected();

		return this;
	},

	flush: function(options) {
		options || (options = {});

		//Get list of bastard ids
		if(typeof options.bastards === "undefined" || options.bastards === null) { //Initialization
			this.$el.empty(); //Reset the View
			window.UserList.reset();

			options.bastards = [];

			var friends = store.findAll("friends");
			var followers = store.findAll("followers");

			//console.log("friends: " + friends.length + " followers: " + followers.length + " bastards: " + friends.length);

			//Need to delete everyone who is following me from the friends list.
			//What's left is the bastards who are not following me back
			for(var x = 0; x < friends.length; x++) {
				for(var y = 0; y < followers.length; y++) {
					if(typeof friends[x] !== "undefined" && friends[x] !== null) {
						if(friends[x].id === followers[y].id) {
							friends.splice(x, 1);
						}
					}
				}
			}

			//console.log("bastards: " + friends.length);

			//No bastards? Good. We are done here!
			if(friends.length === 0) {
				return this;
			}

			//display those bastards
			//Get list of user_id to get details for
			_.each(friends, function(friend){
				options.bastards.push(friend.id);
			});
		} else {
			if(options.bastards.length === 0) { //We're done here
				//True UserList is Users on the DOM
				window.userView.refresh_user_list();

				return this;
			}
		}

		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
	        consumerKey: app_credentials.consumer_key,
	        consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
            accessTokenSecret: user_credentials.oauth_token_secret
	    });

		//Get User details (Single-Call for upto 100 users at a time - POWERFUL!)
		if(options.bastards.length > 100) {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.bastards.splice(0,100);
		} else {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.bastards;
			options.bastards.splice(0, options.bastards.length);
		}

		oauth.get(window.UserList.url, function (data) {
			//Reset the list of Users
			window.UserList.reset(JSON.parse(data.text));

			window.UserList.each(function(user) {
				//Make sure the important nodes are always available
				//undefined = the value of missing properties
				//null = the property exists, but the value is not known
				if (typeof user.get("name") === "undefined" || user.get("name") === null) {
					user.set({name: ""});
				}

				if (typeof user.get("screen_name") === "undefined" || user.get("screen_name") === null) {
					user.set({screen_name: ""});
				}

				if (typeof user.get("location") === "undefined" || user.get("location") === null) {
					user.set({location: ""});
				}

				if (typeof user.get("status") === "undefined" || user.get("status") === null) {
					user.set({status: {text: ""}});
				}

				if (typeof user.get("description") === "undefined" || user.get("description") === null) {
					user.set({description: ""});
				}

				//Autolink: Usernames, Urls and Hashtags
				//user.set({description: window.twttr.txt.autoLink(user.get("description"))});

				$(".users").append(_.template($("#UserTmpl").html())(user.toJSON())); //Add the User to the View

				//Add Twttr.txt to the DOM not to the Data (WORKING CODE)
				var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
				bio.html(window.twttr.txt.autoLink(bio.text()));

				//Highlight Unfollowed Users
				var unfollowlist = store.findAll("unfollowed");

				var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
					return unfollowed.id === user.get("id");
				});

				if(isUnfollowed === true) {
					var unfollowed = $("li[data-id="+ user.get("id") +"]");
					unfollowed.addClass("unfollowed");
				}
			});//window.UserList.each

			//Update API Tokens
			window.appView.rate_limit_status("users", "lookup");

			//Update Users Selected
			window.appView.users_selected();

			//Keep calling the Bastard List until all Bastards are displayed
			window.userView.flush({"bastards": options.bastards});

		});//Get UserList

		return this;
	},

	followback: function(options) {
		options || (options = {});

		//Get list of friend ids
		if(typeof options.saints === "undefined" || options.saints === null) { //Initialization
			this.$el.empty(); //Reset the View
			window.UserList.reset();

			options.saints = [];

			var friends = store.findAll("friends");
			var followers = store.findAll("followers");

			if(followers.length === 0) {
				return this;
			}

			//console.log("friends: " + friends.length + " followers: " + followers.length + " saints: " + followers.length);

			//Need to delete everyone I'm following from the followers list
			//What's left is the people I'm not following back
			for(var x = 0; x < followers.length; x++) {
				for(var y = 0; y < friends.length; y++) {
					if(typeof followers[x] !== "undefined" && followers[x] !== null) {
						if(followers[x].id === friends[y].id) {
							followers.splice(x, 1);
						}
					}
				}
			}

			//console.log("saints: " + followers.length);

			//display those family
			//Get list of user_id to get details for
			_.each(followers, function(follower){
				options.saints.push(follower.id);
			});
		} else {
			if(options.saints.length === 0) { //We're done here
				//True UserList is Users on the DOM
				window.userView.refresh_user_list();

				return this;
			}
		}

		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
	        consumerKey: app_credentials.consumer_key,
	        consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
            accessTokenSecret: user_credentials.oauth_token_secret
	    });

		if(options.saints.length > 100) {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.saints.splice(0,100);
		} else {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.saints;
			options.saints.splice(0, options.saints.length);
		}

		oauth.get(window.UserList.url, function (data) {
			//Reset the list of Users
			window.UserList.reset(JSON.parse(data.text));

			window.UserList.each(function(user) {
				//Make sure the important nodes are always available
				//undefined = the value of missing properties
				//null = the property exists, but the value is not known
				if (typeof user.get("name") === "undefined" || user.get("name") === null) {
					user.set({name: ""});
				}

				if (typeof user.get("screen_name") === "undefined" || user.get("screen_name") === null) {
					user.set({screen_name: ""});
				}

				if (typeof user.get("location") === "undefined" || user.get("location") === null) {
					user.set({location: ""});
				}

				if (typeof user.get("status") === "undefined" || user.get("status") === null) {
					user.set({status: {text: ""}});
				}

				if (typeof user.get("description") === "undefined" || user.get("description") === null) {
					user.set({description: ""});
				}

				//Autolink: Usernames, Urls and Hashtags
				//user.set({description: window.twttr.txt.autoLink(user.get("description"))});

				$(".users").append(_.template($("#UserTmpl").html())(user.toJSON())); //Add the User to the View

				//Add Twttr.txt to the DOM not to the Data (WORKING CODE)
				var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
				bio.html(window.twttr.txt.autoLink(bio.text()));

				//Highlight Unfollowed Users
				var unfollowlist = store.findAll("unfollowed");

				var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
					return unfollowed.id === user.get("id");
				});

				if(isUnfollowed === true) {
					var unfollowed = $("li[data-id="+ user.get("id") +"]");
					unfollowed.addClass("unfollowed");
				}
			});//window.UserList.each

			//Update API Tokens
			window.appView.rate_limit_status("users", "lookup");

			//Update Users Selected
			window.appView.users_selected();

			//Keep calling the Saints List until all Saints are displayed
			window.userView.followback({"saints": options.saints});

		});//Get UserList

		return this;
	},

	zombielist: function(options) {
		options || (options = {});

		//Get list of friend ids
		if(typeof options.zombies === "undefined" || options.zombies === null) { //Initialization
			this.$el.empty(); //Reset the View (On Initialization)
			window.UserList.reset();

			options.zombies = [];

			var friends = store.findAll("friends");

			if(friends.length === 0) {
				return this;
			}

			_.each(friends, function(friend){
				options.zombies.push(friend.id);
			});
		} else {
			if(options.zombies.length === 0) { //We're done here
				//True UserList is Users on the DOM
				window.userView.refresh_user_list();

				return this;
			}
		}

		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
	        consumerKey: app_credentials.consumer_key,
	        consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
            accessTokenSecret: user_credentials.oauth_token_secret
	    });

		if(options.zombies.length > 100) {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.zombies.splice(0,100);
		} else {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.zombies;
			options.zombies.splice(0, options.zombies.length);
		}

		oauth.get(window.UserList.url, function (data) {
			//Reset the list of Users
			window.UserList.reset(JSON.parse(data.text));

			window.UserList.each(function(user) {
				//Make sure the important nodes are always available
				//undefined = the value of missing properties
				//null = the property exists, but the value is not known
				if (typeof user.get("name") === "undefined" || user.get("name") === null) {
					user.set({name: ""});
				}

				if (typeof user.get("screen_name") === "undefined" || user.get("screen_name") === null) {
					user.set({screen_name: ""});
				}

				if (typeof user.get("location") === "undefined" || user.get("location") === null) {
					user.set({location: ""});
				}

				if (typeof user.get("status") === "undefined" || user.get("status") === null) {
					user.set({status: {text: ""}});
				}

				if (typeof user.get("description") === "undefined" || user.get("description") === null) {
					user.set({description: ""});
				}

				//Find out who hasn't Tweeted for over {options.days} days
				var days = Math.round((Date.now() - (Date.parse(user.get("status").created_at) || Date.now())) / (1000 * 60 * 60 * 24));

				if(days > options.days) { //Display the User
					//Autolink: Usernames, Urls and Hashtags
					//user.set({description: window.twttr.txt.autoLink(user.get("description"))});
					$(".users").append(_.template($("#UserTmpl").html())(user.toJSON())); //Add the User to the View

					//Add Twttr.txt to the DOM not to the Data (WORKING CODE)
					var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
					bio.html(window.twttr.txt.autoLink(bio.text()));

					//Highlight Unfollowed Users
					var unfollowlist = store.findAll("unfollowed");

					var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
						return unfollowed.id === user.get("id");
					});

					if(isUnfollowed === true) {
						var unfollowed = $("li[data-id="+ user.get("id") +"]");
						unfollowed.addClass("unfollowed");
					}
				}
			});//window.UserList.each

			//Update API Tokens
			window.appView.rate_limit_status("users", "lookup");

			//Update Users Selected
			window.appView.users_selected();

			//Keep calling the Zombie List until all Zombies are displayed
			window.userView.zombielist({"zombies": options.zombies, "days": options.days});

		});//Get UserList

		return this;
	},

	safelist: function(options) {
		options || (options = {});

		//Get list of friend ids
		if(typeof options.users === "undefined" || options.users === null) { //Initialization
			this.$el.empty(); //Reset the View
			window.UserList.reset();

			options.users = [];

			var safelist = store.findAll("safelist");

			if(safelist.length === 0) {
				return this;
			}

			_.each(safelist, function(user){
				options.users.push(user.id);
			});
		} else {
			if(options.users.length === 0) { //We're done here
				//True UserList is Users on the DOM
				window.userView.refresh_user_list();

				return this;
			}
		}

		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
			consumerKey: app_credentials.consumer_key,
			consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
			accessTokenSecret: user_credentials.oauth_token_secret
	  });

		if(options.users.length > 100) {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.users.splice(0,100);
		} else {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.users;
			options.users.splice(0, options.users.length);
		}

		oauth.get(window.UserList.url, function (data) {
			//Reset the list of Users
			window.UserList.reset(JSON.parse(data.text));

			window.UserList.each(function(user) {
				//Make sure the important nodes are always available
				//undefined = the value of missing properties
				//null = the property exists, but the value is not known
				if (typeof user.get("name") === "undefined" || user.get("name") === null) {
					user.set({name: ""});
				}

				if (typeof user.get("screen_name") === "undefined" || user.get("screen_name") === null) {
					user.set({screen_name: ""});
				}

				if (typeof user.get("location") === "undefined" || user.get("location") === null) {
					user.set({location: ""});
				}

				if (typeof user.get("status") === "undefined" || user.get("status") === null) {
					user.set({status: {text: ""}});
				}

				if (typeof user.get("description") === "undefined" || user.get("description") === null) {
					user.set({description: ""});
				}

				//Autolink: Usernames, Urls and Hashtags
				//user.set({description: window.twttr.txt.autoLink(user.get("description"))});

				$(".users").append(_.template($("#UserTmpl").html())(user.toJSON())); //Add the User to the View

				//Add Twttr.txt to the DOM not to the Data (WORKING CODE)
				var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
				bio.html(window.twttr.txt.autoLink(bio.text()));

				//Add safelist class to User
				var safelist = $("li[data-id="+ user.get("id") +"]");
				safelist.addClass("safelist");

				//Highlight Unfollowed Users
				var unfollowlist = store.findAll("unfollowed");

				var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
					return unfollowed.id === user.get("id");
				});

				if(isUnfollowed === true) {
					var unfollowed = $("li[data-id="+ user.get("id") +"]");
					unfollowed.addClass("unfollowed");
				}
			});//window.UserList.each

			//Update API Tokens
			window.appView.rate_limit_status("users", "lookup");

			//Update Users Selected
			window.appView.users_selected();

			//Keep calling the Safe List until all Users are displayed
			window.userView.safelist({"users": options.users});

		});//Get UserList

		return this;
	},

	ignorelist: function(options) {
		options || (options = {});

		//Get list of friend ids
		if(typeof options.users === "undefined" || options.users === null) { //Initialization
			this.$el.empty(); //Reset the View
			window.UserList.reset();

			options.users = [];

			var ignorelist = store.findAll("ignorelist");

			if(ignorelist.length === 0) {
				return this;
			}

			_.each(ignorelist, function(user){
				options.users.push(user.id);
			});
		} else {
			if(options.users.length === 0) { //We're done here
				//True UserList is Users on the DOM
				window.userView.refresh_user_list();

				return this;
			}
		}

		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
	        consumerKey: app_credentials.consumer_key,
	        consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
            accessTokenSecret: user_credentials.oauth_token_secret
	    });

		if(options.users.length > 100) {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.users.splice(0,100);
		} else {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.users;
			options.users.splice(0, options.users.length);
		}

		oauth.get(window.UserList.url, function (data) {
			//Reset the list of Users
			window.UserList.reset(JSON.parse(data.text));

			window.UserList.each(function(user) {
				//Make sure the important nodes are always available
				//undefined = the value of missing properties
				//null = the property exists, but the value is not known
				if (typeof user.get("name") === "undefined" || user.get("name") === null) {
					user.set({name: ""});
				}

				if (typeof user.get("screen_name") === "undefined" || user.get("screen_name") === null) {
					user.set({screen_name: ""});
				}

				if (typeof user.get("location") === "undefined" || user.get("location") === null) {
					user.set({location: ""});
				}

				if (typeof user.get("status") === "undefined" || user.get("status") === null) {
					user.set({status: {text: ""}});
				}

				if (typeof user.get("description") === "undefined" || user.get("description") === null) {
					user.set({description: ""});
				}

				//Autolink: Usernames, Urls and Hashtags
				//user.set({description: window.twttr.txt.autoLink(user.get("description"))});

				$(".users").append(_.template($("#UserTmpl").html())(user.toJSON())); //Add the User to the View

				//Add Twttr.txt to the DOM not to the Data (WORKING CODE)
				var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
				bio.html(window.twttr.txt.autoLink(bio.text()));

				//Add ignorelist class to User
				var ignorelist = $("li[data-id="+ user.get("id") +"]");
				ignorelist.addClass("ignorelist");

				//Highlight Unfollowed Users
				var unfollowlist = store.findAll("unfollowed");

				var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
					return unfollowed.id === user.get("id");
				});

				if(isUnfollowed === true) {
					var unfollowed = $("li[data-id="+ user.get("id") +"]");
					unfollowed.addClass("unfollowed");
				}
			});//window.UserList.each

			//Update API Tokens
			window.appView.rate_limit_status("users", "lookup");

			//Update Users Selected
			window.appView.users_selected();

			//Keep calling the Ignore List until all Users are displayed
			window.userView.ignorelist({"users": options.users});

		});//Get UserList

		return this;
	},

	haters: function(options) {
		options || (options = {});

		//Get list of friend ids
		if(typeof options.users === "undefined" || options.users === null) { //Initialization
			this.$el.empty(); //Reset the View
			window.UserList.reset();

			options.users = [];

			var haters = store.findAll("haters");

			if(haters.length === 0) {
				return this;
			}

			_.each(haters, function(user){
				options.users.push(user.id);
			});
		} else {
			if(options.users.length === 0) { //We're done here
				//True UserList is Users on the DOM
				window.userView.refresh_user_list();

				return this;
			}
		}

		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");

		var oauth = OAuth({
			consumerKey: app_credentials.consumer_key,
			consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
			accessTokenSecret: user_credentials.oauth_token_secret
	  });

		if(options.users.length > 100) {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.users.splice(0,100);
		} else {
			window.UserList.url = "https://api.twitter.com/1.1/users/lookup.json?user_id=" + options.users;
			options.users.splice(0, options.users.length);
		}

		oauth.get(window.UserList.url, function (data) {
			//Reset the list of Users
			window.UserList.reset(JSON.parse(data.text));

			window.UserList.each(function(user) {
				//Make sure the important nodes are always available
				//undefined = the value of missing properties
				//null = the property exists, but the value is not known
				if (typeof user.get("name") === "undefined" || user.get("name") === null) {
					user.set({name: ""});
				}

				if (typeof user.get("screen_name") === "undefined" || user.get("screen_name") === null) {
					user.set({screen_name: ""});
				}

				if (typeof user.get("location") === "undefined" || user.get("location") === null) {
					user.set({location: ""});
				}

				if (typeof user.get("status") === "undefined" || user.get("status") === null) {
					user.set({status: {text: ""}});
				}

				if (typeof user.get("description") === "undefined" || user.get("description") === null) {
					user.set({description: ""});
				}

				//Autolink: Usernames, Urls and Hashtags
				//user.set({description: window.twttr.txt.autoLink(user.get("description"))});

				$(".users").append(_.template($("#UserTmpl").html())(user.toJSON())); //Add the User to the View

				//Add Twttr.txt to the DOM not to the Data (WORKING CODE)
				var bio = $("li[data-id="+ user.get("id") +"] .bio blockquote");
				bio.html(window.twttr.txt.autoLink(bio.text()));

				//Add haters class to User
				var haters = $("li[data-id="+ user.get("id") +"]");
				haters.addClass("haters");

				//Highlight Unfollowed Users
				var unfollowlist = store.findAll("unfollowed");

				var isUnfollowed = _.any(unfollowlist, function(unfollowed) {
					return unfollowed.id === user.get("id");
				});

				if(isUnfollowed === true) {
					var unfollowed = $("li[data-id="+ user.get("id") +"]");
					unfollowed.addClass("unfollowed");
				}
			});//window.UserList.each

			//Update API Tokens
			window.appView.rate_limit_status("users", "lookup");

			//Update Users Selected
			window.appView.users_selected();

			//Keep calling the Ignore List until all Users are displayed
			window.userView.ignorelist({"users": options.users});

		});//Get UserList

		return this;
	}
});

window.userView = new UserView();
