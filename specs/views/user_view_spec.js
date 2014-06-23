describe("User View", function() {
	var userView;
	
	beforeEach(function() {
		userView = new UserView();
	});
	
	afterEach(function() {
	    delete userView;
	});
	
	describe("when instantiated", function() {
		it("attaches to the main DOM element", function() {
			expect(userView.$el.selector).toEqual(".users");
		});
		
		it("has a class of 'users'", function() {
			userView.render = function() {
		    	this.el = document.createElement("li");
		    	return this;
		  	};
			
			spy = sinon.spy(userView, "render");
			
			userView.render();
			
			expect(userView.render).toHaveBeenCalled();
		});
	});
});