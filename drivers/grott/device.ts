import Homey from 'homey';
import { MqttClient, connect } from 'mqtt';

interface GrottData {
  device: string;
  time: string;
  values: any
}

interface Mapping {
  capability: string;
  property: string;
  divide: boolean;
}

class Grott extends Homey.Device {

  client: MqttClient | undefined = undefined;
  lastPacket: GrottData | undefined = undefined;
  mappings: Mapping[] = [];

  createMapping = (capability: string, property: string, divide: boolean = true): Mapping => {
    return {
      capability,
      property,
      divide,
    };
  }

  parseData = async (data: GrottData) => {
    this.lastPacket = data;

    if (data?.values === undefined) {
      return;
    }

    for (const mapping of this.mappings) {
      const value = data.values[mapping.property];
      if (value !== undefined) {
        this.log(`Setting ${mapping.capability} to ${value}`);

        if (!mapping.divide) {
          await this.setCapabilityValue(mapping.capability, value);
        } else if (value === 0 || Number(value)) {
          await this.setCapabilityValue(mapping.capability, value / 10);
        } else {
          this.error(`Failed to parse ${mapping.property} NaN`, value);
        }
      }
    }
  }

  connectToMqtt = async () => {
    const {
      host, port, topic, username, password, protocol, validateCertificate,
    } = this.getSettings();

    if (this.client && this.client.connected) {
      this.client.end();
    }

    const broker = `${protocol ?? 'mqtt'}://${host}:${port ?? 1883}`;
    this.log(`Connecting to broker ${broker}`);

    const client = connect(`${protocol ?? 'mqtt'}://${host}`, {
      username,
      password,
      port: Number(port),
      rejectUnauthorized: validateCertificate ?? true,
    });

    if (client.connected) {
      this.log('Client connected');
    }

    client.on('connect', () => {
      this.log(`Connected to broker ${broker}, subscribing to ${topic}`);
      this.client = client;
      client.subscribe(topic, () => {
        this.log(`Succesfully subscribed to ${topic}`);
      });
    });

    client.on('error', (error) => {
      this.error(`Failed to connect to broker ${broker}`, error);
      client.end();
    });

    client.on('message', (topic, data, packet) => {
      this.log(`Received packet in ${topic}: ${data.length}`);

      this.parseData(JSON.parse(data.toString()) as GrottData)
        .then(() => {
          this.log('Data from MQTT parsed');
        }).catch((error) => {
          this.error('Failed to parse data from MQTT', error);
        });
    });

    client.on('disconnect', () => {
      this.log('Disconnected from broker', host);
    });
  }

  setupMappings = async () => {
    this.mappings = [];

    this.mappings.push(this.createMapping('measure_power', 'pvpowerout'));

    this.mappings.push(this.createMapping('serial_number.datalogger', 'datalogserial', false));
    this.mappings.push(this.createMapping('serial_number.pv', 'pvserial', false));

    this.mappings.push(this.createMapping('measure_voltage.grid1', 'pvgridvoltage'));
    this.mappings.push(this.createMapping('measure_current.grid1', 'pvgridcurrent'));
    this.mappings.push(this.createMapping('measure_power.grid1', 'pvgridpower'));

    this.mappings.push(this.createMapping('measure_voltage.grid2', 'pvgridvoltage2'));
    this.mappings.push(this.createMapping('measure_current.grid2', 'pvgridcurrent2'));
    this.mappings.push(this.createMapping('measure_power.grid2', 'pvgridpower2'));

    this.mappings.push(this.createMapping('measure_voltage.grid3', 'pvgridvoltage3'));
    this.mappings.push(this.createMapping('measure_current.grid3', 'pvgridcurrent3'));
    this.mappings.push(this.createMapping('measure_power.grid3', 'pvgridpower3'));

    this.mappings.push(this.createMapping('measure_voltage.pv1', 'pv1voltage'));
    this.mappings.push(this.createMapping('measure_current.pv1', 'pv1current'));
    this.mappings.push(this.createMapping('measure_power.pv1', 'pv1watt'));

    this.mappings.push(this.createMapping('measure_voltage.pv2', 'pv2voltage'));
    this.mappings.push(this.createMapping('measure_current.pv2', 'pv2current'));
    this.mappings.push(this.createMapping('measure_power.pv2', 'pv2watt'));

    this.mappings.push(this.createMapping('meter_today_power', 'pvenergytoday'));
    this.mappings.push(this.createMapping('meter_power', 'pvenergytotal'));

    /*
    for (const mapping of this.mappings) {
      await this.removeCapability(mapping.capability);
    }
*/
    for (const mapping of this.mappings) {
      await this.checkCapability(mapping.capability);
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Grott has been initialized');

    await this.setupMappings();

    await this.connectToMqtt();

    const resetEnergyToday = this.homey.flow.getActionCard('reset_energy_today');

    resetEnergyToday.registerRunListener(async (args, state) => {
      if (this.lastPacket) {
        this.lastPacket.values.pvenergytoday = 0;

        const topic = this.getSetting('topic') ?? 'energy/growatt';
        this.client?.publish(topic, JSON.stringify(this.lastPacket));
      }
    });
  }

  checkCapability = async (capabilityName: string) => {
    if (this.hasCapability(capabilityName) === false) {
      this.log('Adding capability', capabilityName);
      await this.addCapability(capabilityName);
    }
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
    oldSettings: {
      [key: string]: boolean | string | number | undefined | null
    };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('Grott settings where changed');

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
      this.log('Disconnecting from MQTT broker');
      this.client.end();
    }

    this.log('Grott has been deleted');
  }

}

module.exports = Grott;
