'use strict';

var mongoose = require('mongoose'),
    _ = require('lodash'),
    jwt = require('jsonwebtoken'),
    ATM = mongoose.model('ATM'),
    Bank = mongoose.model('Bank'),
    State = mongoose.model('State');

var sendJsonResponse = function(res, status, content) {
  res.status(status);
  res.json(content);
};

var theEarth = (function() {
  var earthRaduis = 6371; //km, miles is 3959

  var getDistanceFromRads = function(rads) {
    return parseFloat(rads * earthRaduis);
  };

  var getRadsFromDistance = function(distance) {
    return parseFloat(distance / earthRaduis);
  };

  return {
    getDistanceFromRads : getDistanceFromRads,
    getRadsFromDistance : getRadsFromDistance
  };
})();
function atmsByDistance (req, res) {
  var obj = {}, lng, lat;
  lng = parseFloat(req.query.lng);
  lat = parseFloat(req.query.lat);
  if (req.query.userid) {
    obj.user = req.query.userid;
  }
  // obj.state = 37;
  var maxDistance = parseFloat(req.query.maxDistance) || 100;
  if (!lng && lng !==0 || !lat && lat !==0) {
    sendJsonResponse(res, 404, {
      'message': 'lng and lat query parameters are required'
    });
    return;
  }
  ATM.geoNear(
    [lng, lat],
    {
      spherical: true,  
      //distanceMultiplier: 3959,
      maxDistance: parseFloat(100),
      query: obj
    }, function(err,docs) {
      if (err)
        sendJsonResponse(res, 404, err);

      //mapping each doc into new object and populating distance
      docs = docs.map(function(x) {
        var a = new ATM( x.obj );
        a.distance = theEarth.getDistanceFromRads(x.dis);
        return a;
      });

      // populating user object
      ATM.populate( docs, { path: 'state bank_name', select: 'name' }, function(err,properties) {
          if (err) sendJsonResponse(res, 404, err);
          sendJsonResponse(res, 200, properties);
      });
  });
}

// '/api/v1/atms/add' Method="POST"
exports.addState = function(req, res) {
  State.create({
    _id: req.body.id,
    name: req.body.name,
  }, function(err, state) {
    if (err) {
      sendJsonResponse(res, 403, err);
    }
    sendJsonResponse(res, 201, state);
  });
};

exports.getStates = function(req, res) {
  State
    .find({})
    .select('name')
    .exec(function(err, states) {
      if (err) sendJsonResponse(res, 404, err);
      sendJsonResponse(res, 200, states);
    });
};

exports.addBank = function(req, res) {
  Bank.create({
    id: req.body.id,
    name: req.body.name,
  }, function(err, bank) {
    if (err) {
      sendJsonResponse(res, 403, err);
    }
    sendJsonResponse(res, 201, bank);
  });
};

exports.getBanks = function(req, res) {
  Bank
    .find({})
    .select('name')
    .exec(function(err, banks) {
      if (err) sendJsonResponse(res, 404, err);
      sendJsonResponse(res, 200, banks);
    });
};

//"/api/v1/atms" METHOD="POST"
exports.createATM = function(req, res) {
  var userToken;
  userToken = req.body.token || req.query.token || req.params.token || req.header.token;
  if (!userToken) {
    sendJsonResponse(res, 403, {'message': 'Please enter your token or visit your profile to get your access token'});
    return;
  }
  jwt.verify(userToken, process.env.JWT_SECRET, function(err, user) {
    if (err) {
      sendJsonResponse(res, 401, {'message': 'Incorrect Token, please verify and use correct token'});
      return;
    }
    ATM.create({
    bank_name: req.body.bank,
    address: req.body.address,
    state: req.body.state,
    estimate: req.body.estimate,
    coords: [parseFloat(req.body.lng), parseFloat(req.body.lat)],
    user: user.username
  }, function(err, atm) {
    if (err) {
      sendJsonResponse(res, 400, err);
    } else {
      console.log(atm.id);
      ATM
      .findById(atm._id)
      .populate('state bank_name')
      .exec(function(err, atm1) {
        if (err) {
          sendJsonResponse(res, 400, err);
        }
        sendJsonResponse(res, 201, atm1);
      });
    }
  });
  });
};

//"/api/v1/atms" METHOD="GET"
exports.getAllAtms = function(req, res) {
  atmsByDistance(req, res);
};

//"/api/v1/atms/:id" METHOD="GET"
exports.getOneATM = function(req, res) {
  if (req.params && req.params.atmid) {
    ATM
      .findById(req.params.atmid)
      .populate('state bank_name', 'name')
      .exec(function(err, atm) {
        if (!atm) {
          sendJsonResponse(res, 404, {'message': 'atmid not found'});
          return;
        } else if (err) {
          sendJsonResponse(res, 404, err);
          return;
        }
        sendJsonResponse(res, 200, atm);
      });
  } else {
    sendJsonResponse(res, 404, {'message': 'No atmid in request'});
  }
};

//"/api/v1/atms/:id" METHOD="PUT"
exports.updateATM = function(req, res) {
  if (!req.params.atmid) {
    sendJsonResponse(res, 404, {'message': 'Not found, atmid is required"'});
    return;
  }
  ATM
    .findById(req.params.atmid)
    .exec(function (err, atm) {
      if (!atm) {
        sendJsonResponse(res, 404, {'message': 'atmid not found'});
        return;
      }
      atm = _.extend(atm, req.body);
      atm.updatedOn = Date.now();
      atm.save(function(err, atm) {
        if(err) {
          sendJsonResponse(res, 404, err);
        } else {
          sendJsonResponse(res, 200, atm);
        }
      });
    });
};

//"/api/v1/atms/:id" METHOD="DELETE"
exports.deleteATM = function(req, res) {
  var atmid = req.params.atmid;
  if (atmid) {
    ATM
      .findByIdAndRemove(atmid)
      .exec(function(err, atm) {
        if (err) {
          sendJsonResponse(res, 404, err);
          return;
        }
        sendJsonResponse(res, 204, null);
      }); 
  } else {
    sendJsonResponse(res, 404, {'message': 'No atmid'});
  }
};

//"/api/v1/atms/search" METHOD="GET"
exports.queryATM = function(req, res) {
  var obj = {};
  var bankName = req.query.bank;
  var stateValue = req.query.state;
  if (bankName && stateValue) {
    obj.bank_name = bankName;
    obj.state = stateValue;
    ATM
      .find(obj)
      .exec(function(err, atms) {
        if (err) {
          sendJsonResponse(res, 404, err);
          return;
        }
        sendJsonResponse(res, 200, atms);
      });
  } else if (bankName) {
    obj.bank_name = bankName;
    ATM
      .find(obj)
      .exec(function(err, atms) {
        if (err) {
          sendJsonResponse(res, 404, err);
          return;
        }
        sendJsonResponse(res, 200, atms);
      });
  } else if (stateValue) {
    obj.state = stateValue;
    ATM
      .find(obj)
      .exec(function(err, atms) {
        if (err) {
          sendJsonResponse(res, 404, err);
          return;
        }
          sendJsonResponse(res, 200, atms);
        });
  } else if (!bankName && !stateValue) {
    ATM
      .find(obj)
      .exec(function(err, atms) {
        if (err) {
          sendJsonResponse(res, 404, err);
          return;
        }
        sendJsonResponse(res, 200, atms);
      });
  }
};

exports.getUserAtms = function(req, res) {
  atmsByDistance(req, res);
};