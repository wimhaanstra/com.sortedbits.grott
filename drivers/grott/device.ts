import Homey from 'homey';
import { MqttClient, connect } from 'mqtt';

interface GrottData {
  device: string;
  time: string;
  values: GrottDataValues
}

interface GrottDataValues {
  pvpowerout: number;
  pvgridvoltage: number;
  pvgridvoltage2: number;
  pvgridvoltage3: number;
  pvenergytoday: number;
  pvenergytotal: number;
}

class Grott extends Homey.Device {

  client: MqttClient | undefined = undefined;
  lastPacket: GrottData | undefined = undefined;

  async parseData(data: GrottData) {
    this.lastPacket = data;

    if (data.values.pvpowerout !== undefined) {
      this.setCapabilityValue('measure_power', data.values.pvpowerout / 10);
    }

    const averageVoltage = ((data.values.pvgridvoltage + data.values.pvgridvoltage2 + data.values.pvgridvoltage3) / 3) / 10;
    this.setCapabilityValue('measure_voltage', averageVoltage);
    this.setCapabilityValue('meter_today_power', data.values.pvenergytoday / 10);
    this.setCapabilityValue('meter_total_power', data.values.pvenergytotal / 10);
  }

  async connectToMqtt() {

    const host = this.getSetting('host');
    const port = this.getSetting('port') ?? 1883;
    const topic = this.getSetting('topic') ?? 'energy/growatt';
    const username = this.getSetting('username');
    const password = this.getSetting('password');

    if (this.client && this.client.connected) {
      this.client.end();
    }

    const broker = `${host}:${port}`;
    this.log(`Connecting to broker ${broker}`);

    const client = connect(`mqtt://${host}`, {
      username: username,
      password: password,
      port: Number(port),
    })

    if (client.connected) {
      this.log('Client connected');
    }

    client.on('connect', () => {
      this.log(`Connected to broker, subscribing to ${topic}`);
      this.client = client;
      client.subscribe(topic, () => {
        this.log(`Succesfully subscribed to ${topic}`)
      });
    });

    client.on('message', (topic, data, packet) => {
      this.log(`Received packet in ${topic}: ${data.length}`);
      
      this.parseData(JSON.parse(data.toString()) as GrottData);
    })

    client.on('disconnect', () => {
      this.log('Disconnected from broker');
    })
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Grott has been initialized');

    this.connectToMqtt();    

    const resetEnergyToday = this.homey.flow.getActionCard('reset_energy_today');

    resetEnergyToday.registerRunListener(async (args, state) => {
      if (this.lastPacket) {
        this.lastPacket.values.pvenergytoday = 0;

        const topic = this.getSetting('topic') ?? 'energy/growatt';
        this.client?.publish(topic, JSON.stringify(this.lastPacket));
      }
    });
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Grott has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log("Grott settings where changed");

    await this.connectToMqtt();
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('Grott was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    if (this.client && this.client.connected) {
      this.log(`Disconnecting from MQTT broker`);
      this.client.end();
    }

    this.log('Grott has been deleted');
  }

}

module.exports = Grott;
