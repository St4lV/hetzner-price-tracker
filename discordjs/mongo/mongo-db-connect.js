const mongoose = require('mongoose');
const { mongo_host , mongo_port , mongo_db} = require('../config.json');
const Joi = require('joi');
const connectDB = async () => {
  try {
    const url = `${mongo_host}:${mongo_port}/${mongo_db}`
    await mongoose.connect(url);
    console.log("MongoDB connected!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

const ServiceAlert = mongoose.model("service_alert", new mongoose.Schema({
  service_id: { type: mongoose.Schema.Types.Int32, required: true, unique: true },
  alerts: [{
    price : { type: mongoose.Schema.Types.Int32, required: true },
    send : { type: mongoose.Schema.Types.Boolean, required: false },
    user_subscribed:[{type:mongoose.Schema.Types.BigInt,required:true}]
  }]
}));

const updateUserAlertSchema = Joi.object({
  user_id: Joi.number().unsafe(),
  service_id: Joi.number().required(),
  alert_price: Joi.number().required()
});

async function UpdateAlert(req) {
  const { user_id, service_id, alert_price } = req.body;
  const { error } = updateUserAlertSchema.validate(req.body);
  if (error) {
    console.log(user_id, service_id, alert_price)
    return { error: ('Joi: '+error.details[0].message) };
  }
  try {
    let service = await ServiceAlert.findOne({ service_id });
    if (!service) {
      const newService = new ServiceAlert({
        service_id,
        alerts: [{
          price: alert_price,
          send: false,
          user_subscribed: [user_id]
        }]
      });
      await newService.save();
      return { response: 'Alert created and user subscribed' };
    }
    let alert = service.alerts.find(alert => alert.price === alert_price);
    if (!alert) {
      service.alerts.push({
        price: alert_price,
        send: false,
        user_subscribed: [user_id]
      });
    } else {
      if (!alert.user_subscribed.includes(user_id)) {
        alert.user_subscribed.push(user_id);
      }
    }
    await service.save();
    return { response: 'Alert updated successfully' };
  } catch (error) {
      console.error("Error in UpdateAlert(req=Object) process:", error);
      return { error: "Internal Error" };
    }
    
  }

async function RemoveAlert(req) {
  const { user_id, service_id, alert_price } = req.body;//console.log({ user_id, service_id, alert_price });
  try {
    const { error } = updateUserAlertSchema.validate(req.body);
    if (error) {
      return { error: 'Joi: ' + error.details[0].message };
    }

    let service = await ServiceAlert.findOne({ service_id });
    if (!service) {
      return { no_alert: 'Service not found' };
    }

    let alertIndex = service.alerts.findIndex(a => a.price === Number(alert_price));
    if (alertIndex === -1) {
      return { no_alert: 'Alert not found for this price' };
    }

    let alert = service.alerts[alertIndex];

    const userIndex = alert.user_subscribed.indexOf(BigInt(user_id));
    if (userIndex === -1) {
      return { no_alert: 'User not assigned to specified alert' };
    }

    alert.user_subscribed.splice(userIndex, 1);

    if (alert.user_subscribed.length === 0) {
      service.alerts.splice(alertIndex, 1);
    }

    if (service.alerts.length === 0) {
      await ServiceAlert.deleteOne({ service_id });
      return { response: 'All alerts removed, service deleted' };
    } else {
      await service.save();
      return { response: 'Unsubscribed user successfully' };
    }

  } catch (error) {
    console.error(error);
    return { error: 'Internal server error' };
  }
}

module.exports = { connectDB, UpdateAlert, RemoveAlert };
