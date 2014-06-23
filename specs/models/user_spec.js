describe("User Model", function() {
	var user;
	
	beforeEach(function() {
		user = new User();
	});
	
	afterEach(function() {
	    delete user;
	});
	
	describe("when instantiated", function() {
		it("is valid without a value", function() {
			expect(user).toBeDefined();
		});

		it("exhibits valid attributes", function() {
			user.set({"username": "tiandavis"});
			expect(user.get("username")).toEqual("tiandavis");
		});
	});
	
	describe("points to the correct REST endpoint", function() {
		beforeEach(function() {
			this.server = sinon.fakeServer.create();
	    });

	    afterEach(function() {
	      this.server.restore();
	    });
	
		it("fires a callback when 'sync' is triggered", function() {
			var spy = sinon.spy();

			user.set({"username" : "tiandavis"});
			user.bind("sync", spy);

			user.trigger("sync"); 

			expect(spy.called).toBeTruthy();
		});
		
		it("is valid when pointing to api.twitter.com endpoint", function() {
			user.urlRoot = "https://api.twitter.com/1.1/search/tweets.json?result_type=mixed&count=100&q='dhh'";
			expect(user.urlRoot).toEqual("https://api.twitter.com/1.1/search/tweets.json?result_type=mixed&count=100&q='dhh'");
		});

		it("is valid when server fetchs from api.twitter.com endpoint", function() {		
			var endpoint = "https://api.twitter.com/1.1/search/tweets.json?result_type=mixed&count=100&q='dhh'";
				
			var spy = sinon.spy(jQuery, "ajax");
			
			user.urlRoot = endpoint;
			user.fetch();
			
			expect(spy.getCall(0).args[0].url).toEqual(endpoint);
			
			jQuery.ajax.restore();
		});
		
		it("passes valid attributes to the endpoint", function() {
			var endpoint = "https://api.twitter.com/1.1/search/tweets.json?result_type=mixed&count=100&q='dhh'";
			var response = "{'errors':[{'message':'Bad Authentication data','code':215}]}";
			
			var spy = sinon.spy(jQuery, "ajax");
			
			this.server.respondWith(
	        	"GET", endpoint,
				[200, {"Content-Type": "application/json"}, response]
			);
			
			var callback = sinon.spy();
			
			jQuery.ajax({
				url: endpoint,
			    success: callback
			});
			
			this.server.respond();
			
			expect(this.server.requests[0].responseText).toEqual(response);
		});
	});
});