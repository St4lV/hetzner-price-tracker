const mongoose = require('mongoose');
const { mongo_host , mongo_port , mongo_db} = require('../config.json');
const Joi = require('joi');
const package = require('../package.json');

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

async function SendAlerts() {
  try {
    const services = await ServiceAlert.find({}, { service_id: 1, _id: 0 });
    const serviceIds = services.map(service => service.service_id);
    const res = await fetch('http://localhost:3000/service/get-price-latest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_ids: serviceIds })
    });

    if (!res.ok) {
      return;
    }

    const latestPrices = await res.json();
    const { client } = require('../index');

    for (const item of latestPrices.response) {
      const service = await ServiceAlert.findOne({ service_id: item.id });

      if (!service || !Array.isArray(service.alerts)) continue;

      let modified = false;

      for (const alert of service.alerts) {
        if (alert.price >= item.latestPrice) {
          if (alert.send !== true && Array.isArray(alert.user_subscribed)) {
            for (const userId of alert.user_subscribed) {
              try {
                const user = await client.users.fetch(userId.toString());
                await user.send(`-# 🔔 * **Alert** message to **${user.tag}*** 🔔\n 🐀📢 Alert for service **${item.id} ↘️ ${alert.price}€**\n Actual price **${item.latestPrice}€**.\n-# - **${package.displayName} ${package.version}**`);
              } catch (err) {
                console.error(`Error with message send to ${user.tag} (${userId}) :`, err);
              }
            }
            alert.send = true;
            modified = true;
          }
        } else if (alert.price < item.latestPrice && alert.send === true) {
          alert.send = false;
          modified = true;
        }
      }
      if (modified) {
        try {
          await service.save();
        } catch (err) {
          console.error(`Error with service ${item.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("Error :", error);
  }
}

module.exports = { connectDB, UpdateAlert, RemoveAlert, SendAlerts };
