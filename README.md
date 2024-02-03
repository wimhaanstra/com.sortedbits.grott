# Grott

Adds support for [Grott MQTT topics](https://github.com/johanmeijer/grott) to Homey.

Currently there are a bunch of limitations:

- Limited MQTT connection options:
    - Only MQTT and WS protocol supported
    - Ability to enable/disable certificate validation
    - No TLS support
    - No basepath support

### Supported apabilities

```
[
    "meter_today_power",
    "meter_power",
    "measure_power",

    "measure_voltage.pv1",
    "measure_current.pv1",
    "measure_power.pv1",

    "measure_voltage.pv2",
    "measure_current.pv2",
    "measure_power.pv2",

    "measure_voltage.grid1",
    "measure_current.grid1",
    "measure_power.grid1",

    "measure_voltage.grid2",
    "measure_current.grid2",
    "measure_power.grid2",

    "measure_voltage.grid3",
    "measure_current.grid3",
    "measure_power.grid3",

    "serial_number.datalogger",
    "serial_number.pv"
],
```