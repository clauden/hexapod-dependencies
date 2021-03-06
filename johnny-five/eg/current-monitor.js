var five = require("../lib/johnny-five.js");
var scale = five.Fn.scale;
var board = new five.Board();
// Measured with multimeter @ 4.440V
var VCC = 4440;

function toMV(value) {
  // Scale an ADC reading to milli-volts.
  return scale(value, 0, 1023, 0, VCC) | 0;
}

function render(mA) {
  // mA means milli-amps
  var mAF = mA.toFixed(2);

  mA = Number(mAF);

  // Limit bar rendering to values that are unique from the
  // previous reading. This prevents an overwhelming number
  // of duplicate bars from being displayed.
  if (render.last !== mA) {
    console.log(
      mAF + ": " + "▇".repeat(scale(mA, 0.03, 2, 1, 50))
    );
  }
  render.last = mA;
}

board.on("ready", function() {
  // Set up a 1kHz frequency sensor, with a name
  // that's similar to the type of sensor we're using.
  // This is a smart way to keep track of your physical
  // devices throughout the program.
  var acs = new five.Sensor({
    pin: "A0",
    freq: 1
  });
  var time = Date.now();
  var samples = 100;
  var accumulator = 0;
  var count = 0;
  var amps = 0;
  var qV = 0;

  acs.on("data", function() {
    // ADC stands for Analog-to-Digital Converter
    // (https://en.wikipedia.org/wiki/Analog-to-digital_converter)
    // which reads the voltage returning to an analog pin from
    // a sensor circuit. The value is a 10-bit representation
    // (0-1023) of a voltage quantity from 0V-5V.
    var adc = 0;
    var currentAmps = 0;

    // The "amps factor" or `aF` is calculated by dividing the
    // the voltage by the max ADC value to produce the
    // incremental value, which is ~0.0049V for each step
    // from 0-1023.
    // Use real VCC (from milli-volts)
    var aF = (VCC / 100) / 1023;


    // 1. Measure the the ACS712 reading with no load (0A);
    //    this is known as the quiescent output voltage,
    //    which is named `qV` in this program.
    if (!qV) {
      if (!count) {
        console.log("Calibrating...");
      }
      // Calibration phase takes measurements for ~5 seconds
      if (count < (samples * 40)) {
        count++;
        accumulator += this.value;
      } else {
        qV = Math.max(512, (accumulator / (samples * 40)) | 0);
        accumulator = count = 0;

        console.log("qV: %d (%d) ", toMV(qV), qV);
        console.log("Elapsed: ", Date.now() - time);
      }
    } else {

      if (count < samples) {
        // 2. Collect readings to calculate a current value
        count++;
        adc = this.value - qV;
        accumulator += adc * adc;
      } else {
        // 3. Update the running root mean square value
        currentAmps = Math.sqrt(accumulator / samples) * aF;
        accumulator = count = 0;

        // ACS is fairly innaccurate below 0.03
        if (currentAmps < 0.03) {
          currentAmps = 0;
        }
      }

      // If there is a currentAmps value:
      //    If there is an amps value:
      //      return average of currentAmps and amps
      //    Else:
      //      return currentAmps
      // Else:
      //    return amps
      amps = currentAmps ?
        (amps ? (currentAmps + amps) / 2 : currentAmps) :
        amps;

      if (qV && amps) {
        render(amps);
      }
    }
  });
});
