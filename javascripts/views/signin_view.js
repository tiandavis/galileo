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
var SigninView = Backbone.View.extend({
	el: $("#galileo"),
	
	path: "chrome-extension://{id}/".replace("{id}", document.location.hostname),
	
	initialize: function() {
		//Display the Consumer Key and Consumer Secret (if available)
		var app_credentials = store.query("credentials", "type", "app");

		if(typeof app_credentials !== "undefined" && app_credentials !== null) {
			$("#ConsumerKey").val(app_credentials.consumer_key);
			$("#ConsumerSecret").val(app_credentials.consumer_secret);
		}
		
		//Application's temporary oauth_token - Need to get the User's permanent oauth_token
		var oauth_token = this.query({variable: "oauth_token", query: window.location.search.substring(1)});
		
		//Similar to the PIN, but User won't have to enter it anywhere
		var oauth_verifier = this.query({variable: "oauth_verifier", query: window.location.search.substring(1)});
		
		//Authorization was successful. Let's authenticate (Get this particular User's oauth_token and oauth_token_secret):
		if(typeof oauth_token !== "undefined" && oauth_token !== null && typeof oauth_verifier !== "undefined" && oauth_verifier !== null) {
			this.authenticate({oauth_token: oauth_token, oauth_verifier: oauth_verifier});
		} else {
			//No oauth_token or oauth_verifier -- User might be authenicated
			//If authenticated the User should be in localStorage
			var user = store.query("credentials", "type", "user");

			if(typeof user !== "undefined" && user !== null) {
				//User already signed in -- So redirect to Galileo
				window.location = this.path + "galileo.html";
			}
		}
    },

	query: function(options) {
		options || (options = {});
		
        //var query = window.location.search.substring(1);
		var query = options.query || "";
		
        var vars = query.split("&");
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");
            if (pair[0] === options.variable) {
                return decodeURIComponent(pair[1]);
            }
        }
    },

	events: {
		"click .signin-with-twitter"				: "authorize"
    },
	
	authorize: function(options) {
		options || (options = {});
		
		//Kick warning if these are empty
		var consumer_key = $("#ConsumerKey").val().trim();
		var consumer_secret = $("#ConsumerSecret").val().trim();
		
		if(consumer_key === "" || consumer_secret === "") {
			$.jnotify("Consumer Key & Consumer Secret - <a href=\"http://techoctave.com/galileo/faq\" target=\"_blank\">Takes 5 minutes!</a>", "warning", 5000);
			return false;
		}
		else {
			//Persist app Credentials to localStorage
			var credential = {
				"id": "0",
				"screen_name": "",
				"consumer_key": consumer_key, 
				"consumer_secret": consumer_secret,
				"type": "app"
			};
			
			//Overwrite each time, never know when the user will update
			store.destroy("credentials", {id: "0"});
			store.create("credentials", credential);
		}
		
		//App Credentials should exist in localStorage by now
		var app_credentials = store.query("credentials", "type", "app");
		
		//Start First Step in OAuth Dance => Authorization
		var oauth, credentials;

	    credentials = {
			//https://dev.twitter.com/discussions/23271
			//https://dev.twitter.com/discussions/6913
			//http://stackoverflow.com/questions/11700008/custom-url-for-my-extension
			//https://dev.twitter.com/discussions/5749
			//https://dev.twitter.com/discussions/392
			//https://code.google.com/p/chromium/issues/detail?id=310870
			//http://developer.chrome.com/extensions/manifest/web_accessible_resources.html
			
	        callbackUrl: this.path + "signin.html",
			consumerKey: app_credentials.consumer_key,
	        consumerSecret: app_credentials.consumer_secret
	    };

	    oauth = OAuth(credentials);
		
		oauth.get("https://api.twitter.com/oauth/request_token", function (data) {
			window.location = "https://twitter.com/oauth/authorize?" + data.text;
	    });
	},
	
	authenticate: function(options) {
		options || (options = {});
		
		var oauth;
		var self = this;
		
		oauth = OAuth({});
		
		oauth.get("https://api.twitter.com/oauth/access_token?oauth_token=" + options.oauth_token + "&oauth_verifier=" + options.oauth_verifier, function (data) {
	
			var oauth_token = self.query({variable: "oauth_token", query: data.text});
			var oauth_token_secret = self.query({variable: "oauth_token_secret", query: data.text});
			var user_id = self.query({variable: "user_id", query: data.text});
			var screen_name = self.query({variable: "screen_name", query: data.text});
			
			//console.log("oauth_token: " + oauth_token);
			//console.log("oauth_token_secret: " + oauth_token_secret);
			//console.log("user_id: " + user_id);
			//console.log("screen_name: " + screen_name);
			
			if(	typeof oauth_token === "undefined" || oauth_token === null || 
			  	typeof oauth_token_secret === "undefined" || oauth_token_secret === null ||
				typeof user_id === "undefined" || user_id === null ||
				typeof screen_name === "undefined" || screen_name === null ) {
				return self;
			}
			else {
				//Persist authenticated User to localStorage
				var credential = { 
					"id": user_id,
					"screen_name": screen_name,
					"oauth_token": oauth_token, 
					"oauth_token_secret": oauth_token_secret,
					"type": "user"
				};
				
				store.create("credentials", credential);
				
				//Forward Galileo application
				window.location = self.path + "galileo.html";
			}
	    });
	}
});

window.signinView = new SigninView();