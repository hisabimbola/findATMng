'use strict';

module.exports = function(app) {
  var express = require('express');
  var atms = require('../../app/controllers/atms.server.controller');
  var router = express.Router();
  app.use('/api/v2/atms', router);
  // router.use();
    router.route('/search')
      .get(atms.queryATM);
    router.route('/')
      .get(atms.ATMByDistance)
      .post(atms.createATM);
    router.route('/:id')
      .get(atms.getOneATM)
      .post(atms.updateATM)
      .delete(atms.deleteATM);
};
