// function reversetring(str){
//     let reversed = "";

//     for(let i = str.length - 1; i >= 0; i-- ){
//        reversed += str[i];    
//     }

//     return reversed;

// }

// const input= "Hello";

// console.log(reversetring(input));


// const user = {
//   name: "Arun"
// };

// user.name = "Kumar"; // allowed

// console.log(user);

export const EXPECTED_MINUTES_IN_OVEN = 40;

export function remainingMinutesInOven(actualMinutesInOven) {
  return EXPECTED_MINUTES_IN_OVEN - actualMinutesInOven;
}

export function preparationTimeInMinutes(numberOfLayers) {
  return numberOfLayers * 2;
}

export function totalTimeInMinutes(numberOfLayers, actualMinutesInOven) {
  return preparationTimeInMinutes(numberOfLayers) + actualMinutesInOven;
}

console.log(preparationTimeInMinutes);