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
$(function(){
 
var AppView = Backbone.View.extend({
	el: $("#galileo"),
	
	path: "chrome-extension://{id}/".replace("{id}", document.location.hostname),
	
	MAX_FOLLOWS: 200,
	
	MAX_UNFOLLOWS: 200,
	
	initialize: function() {
		//Show who's logged in @ galileo.html
		var user_credentials = store.query("credentials", "type", "user");
		
		if(typeof user_credentials !== "undefined" && user_credentials !== null) {
			$("#session").html(_.template($("#AuthTmpl").html())({id: user_credentials.id, screen_name: user_credentials.screen_name}));
		} else {
			//Unauthorized User - Force Signin
			window.location = this.path + "signin.html";
		}
		
		//Get statistics on current user. E.g. api tokens, following, followers
		this.totals();
		
		this.follows();
		this.unfollows();
    },

	events: {
		"keypress input#search"			: "search_on_enter",
		"keyup input#filter"			: "filter",
		"click .sort-by-followers"		: "sort_by_followers",
		"click .sort-by-name"			: "sort_by_name",
		"click .sort-by-username"		: "sort_by_username",
		"click .sort-by-location"		: "sort_by_location",
		"click #logout"					: "logout",
		"click #select_all"				: "select_all",
		"click #remove_selected"		: "remove_selected",
		"click #remove_unfollowed"		: "remove_unfollowed",
		"click #remove_websiteless"		: "remove_websiteless",
		"click #remove_bioless"			: "remove_bioless",
		"click #add_safelist"			: "add_safelist",
		"click #add_ignorelist"			: "add_ignorelist",
		"click #follow_selected"		: "follow_selected",
		"click #unfollow_selected"		: "unfollow_selected",
		"click #flush"					: "flush",
		"click #followback"				: "followback",
		"click #zombielist"				: "zombielist",
		"click #safelist"				: "safelist",
		"click #ignorelist"				: "ignorelist"
    },

 	search_on_enter: function(e) {
		var value = $("input#search").val();

		if (e.keyCode === 13 && value.length > 0) {
			window.userView.search({term: value});
		}
    },

	filter: function(e) {
		var value = $("input#filter").val();
		
		window.userView.filter({term: value});
	},

	sort_by_followers: function() {
		window.userView.sort({property: "followers_count", reverse: true});
	},
	
	sort_by_name: function() {
		window.userView.sort({property: "name"});
	},
	
	sort_by_username: function() {
		window.userView.sort({property: "screen_name"});
	},
	
	sort_by_location: function() {
		window.userView.sort({property: "location"});
	},
	
	logout: function() {
		//Remove authenticated user
		var id = $("#session span em#logout").data("id");

		store.destroy("credentials", {id: id});

		//Redirect to signin page
		window.location = this.path + "signin.html";
	},
	
	totals: function() {
		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");
		
		var oauth = OAuth({
	        consumerKey: app_credentials.consumer_key,
	        consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
            accessTokenSecret: user_credentials.oauth_token_secret
	    });
	
		oauth.get("https://api.twitter.com/1.1/users/show.json?user_id=" + user_credentials.id, function (data) {
			var totals = JSON.parse(data.text);
			
			$("#listed_count span").text(totals.listed_count);
			$("#followers_count span").text(totals.followers_count);
			$("#friends_count span").text(totals.friends_count);
			
			//Update API Tokens
			window.appView.rate_limit_status("users", "show");
	    });
	},
	
	follows: function() {
		var followlist = store.findAll("followed");
		
		var today = _.select(followlist, function(followed) {
			return (Math.round(Date.now()/1000) - followed.timestamp) < 86400;
		});
		
		//FOLLOWS: 0 OF 200/DAY
		var update = "FOLLOWS: " + today.length + " OF " + this.MAX_FOLLOWS + "/DAY";
		$("#follows").text(update);
		
		return today.length;
	},
	
	unfollows: function() {
		var unfollowlist = store.findAll("unfollowed");
		
		var today = _.select(unfollowlist, function(unfollowed) {
			return (Math.round(Date.now()/1000) - unfollowed.timestamp) < 86400;
		});

		//UNFOLLOWS: 0 OF 200/DAY
		var update = "UNFOLLOWS: " + today.length + " OF " + this.MAX_UNFOLLOWS + "/DAY";
		$("#unfollows").text(update);
		
		return today.length;
	},
	
	rate_limit_status: function(family, method) {
		//Get the authenticated User
		var app_credentials = store.query("credentials", "type", "app");
		var user_credentials = store.query("credentials", "type", "user");
		
		var oauth = OAuth({
	        consumerKey: app_credentials.consumer_key,
	        consumerSecret: app_credentials.consumer_secret,
			accessTokenKey: user_credentials.oauth_token,
            accessTokenSecret: user_credentials.oauth_token_secret
	    });
	
		//https://api.twitter.com/1.1/application/rate_limit_status.json?resources=help,users,search,statuses
		oauth.get("https://api.twitter.com/1.1/application/rate_limit_status.json?resources=" + family, function (data) {
			//Get the list of resources for a particular family
			var resources = JSON.parse(data.text).resources[family];
			var rate_limit_status = {"remaining": 0, "limit": 0};
			var endpoint = "";
			
			//Grab the rate_limit_status for a particular resource
			for(var resource in resources) {
				if(resources.hasOwnProperty(resource)) {
					if(resource.indexOf(method) !== -1) {
						endpoint = resource;
						rate_limit_status = resources[resource];
					}
				}
			}
			
			//Display the rate_limits_status for a particular resource to the customer
			var update = "API TOKENS {0} {1} OF {2} (EVERY 15 MINUTES)".replace("{0}", endpoint).toUpperCase()
																	   .replace("{1}", rate_limit_status.remaining)
																	   .replace("{2}", rate_limit_status.limit);
			
			$("#tokens").text(update);
	    });
	},
	
	select_all: function() {
		window.userView.select_all();
	},
	
	users_selected: function() {
		var update = "USERS SELECTED: " + $(".selected").length + " OF " + $(".users .user").length;
		$("#selected").text(update);
	},
	
	remove_selected: function() {
		window.userView.remove_selected();
	},
	
	remove_unfollowed: function() {
		window.userView.remove_unfollowed();
	},
	
	remove_websiteless: function() {
		window.userView.remove_websiteless();
	},
	
	remove_bioless: function() {
		window.userView.remove_bioless();
	},
	
	add_safelist: function() {
		window.userView.add_safelist();
	},
	
	add_ignorelist: function() {
		window.userView.add_ignorelist();
	},
	
	follow_selected: function() {
		window.userView.follow_selected();
	},
	
	unfollow_selected: function() {
		window.userView.unfollow_selected();
	},
	
	flush: function() {
		window.userView.flush();
	},
	
	followback: function() {
		window.userView.followback();
	},
	
	zombielist: function() {
		//Get number of days
		var days = prompt("Enter days since last tweet:", 90);

		if(typeof days !== "undefined" && days !== null) {
			window.userView.zombielist({"days": days});
		}
	},
	
	safelist: function() {
		window.userView.safelist();
	},
	
	ignorelist: function() {
		window.userView.ignorelist();
	}
});

window.appView = new AppView();

});