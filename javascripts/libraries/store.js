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
var store = (function(){
	var name = "";
	var data = "";

	//Generate four random hex digits.
	S4 = function() {
	   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
	};

	//Generate a pseudo-GUID by concatenating random hexadecimal.
	guid = function() {
	   return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
	};
	
	build = function(name) {
		this.name = name;
		var store = localStorage.getItem(this.name);

		this.data = (store && JSON.parse(store)) || {};
	};
	
	//Save the current state of the **Store** to *localStorage*.
	save = function() {
		localStorage.setItem(this.name, JSON.stringify(this.data));
	};

	//Add a model
	create = function(name, model) {
		if(name === "credentials") {
			this.build(name);
		}
		else {
			var user_id = credentials("type", "user").id;
			this.build(name + "_" + user_id);
		}
		
		//Store the model if it doesn't already exist.
		if (typeof this.data[model.id] === "undefined" || this.data[model.id] === null) {
			this.data[model.id] = model;
			this.save();
			
			return true;
		} 
		else {
			return false;
		}
	};
	
	//Update a model
	update = function(name, model) {
		if(name === "credentials") {
			this.build(name);
		}
		else {
			var user_id = credentials("type", "user").id;
			this.build(name + "_" + user_id);
		}
		
		if (typeof this.data[model.id] !== "undefined" && this.data[model.id] !== null) {
			this.data[model.id] = model;
			this.save();

			return true;
		} 
		else {
			return false;
		}
	};

	//Retrieve a model from 'this.data' by id.
	find = function(name, model) {
		if(name === "credentials") {
			this.build(name);
		}
		else {
			var user_id = credentials("type", "user").id;
			this.build(name + "_" + user_id);
		}
		
	  	return this.data[model.id];
	};

	//Return the array of all models currently in storage.
	findAll = function(name) {
		if(name === "credentials") {
			this.build(name);
		}
		else {
			var user_id = credentials("type", "user").id;
			this.build(name + "_" + user_id);
		}
		
	  	return _.values(this.data);
	};
	
	//Retrieve a model from 'this.data' by attribute key/value pair.
	query = function(name, key, value) {
		if(name === "credentials") {
			this.build(name);
		}
		else {
			var user_id = credentials("type", "user").id;
			this.build(name + "_" + user_id);
		}
		
		var collection = _.values(this.data);
		
		var items = _.select(collection, function(item){
			return item[key] === value;
		});
		
		if (items.length === 1) {
			return items.pop();
		}
		
		if (items.length > 1) {
			return items;
		}
	};
	
	//Wrapper to get the Galileo User's Crendentials
	credentials = function(key, value) {
		this.build("credentials");
		
		var collection = _.values(this.data);
		
		var items = _.select(collection, function(item){
			return item[key] === value;
		});
		
		if (items.length === 1) {
			return items.pop();
		}
		
		if (items.length > 1) {
			return items;
		}
	};

	//Delete a model from `this.data`, returning it.
	destroy = function(name, model) {
		if(name === "credentials") {
			this.build(name);
		}
		else {
			var user_id = credentials("type", "user").id;
			this.build(name + "_" + user_id);
		}
		
		delete this.data[model.id];
	  	this.save();
	
		return model;
	};
	
	//Empty a localStorage item
	empty = function(name) {
		if(name === "credentials") {
			return false;
		}
		else {
			var user_id = credentials("type", "user").id;
			localStorage.setItem(name + "_" + user_id, "");
			return true;
		}
	};

	return this;
})();