import { Collection, ObjectId } from "mongodb";
import { Vehicles, VehiclesModel, PartsModel, Parts } from "./types.ts";
import { fromModelToParts, fromModelToVehicle } from "./utils.ts";

// Función para obtener una broma aleatoria de una API
async function getRandomJoke(): Promise<string> {
    const response = await fetch("https://official-joke-api.appspot.com/jokes/random");
    const data = await response.json();
  
    // Verifica si la respuesta tiene la propiedad 'setup' y 'punchline'
    if (data && data.setup && data.punchline) {
      return `${data.setup} - ${data.punchline}`; // Concatenamos setup y punchline
    }
  
    // Si no tiene 'setup' y 'punchline', retorna un mensaje de error por defecto
    return "No joke available";
  }
  

export const resolvers = {
  Query: {
    // Consulta un vehículo por ID
    vehicle: async (
      _: unknown,
      { id }: { id: string },
      context: {
        vehiclesCollection: Collection<VehiclesModel>;
        partsCollection: Collection<PartsModel>;
      }
    ): Promise<Vehicles | null> => {
      const vehiculoModel = await context.vehiclesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!vehiculoModel) {
        return null;
      }
      return fromModelToVehicle(vehiculoModel, context.partsCollection);
    },

    // Consulta todos los vehículos
    vehicles: async (
      _: unknown,
      __: unknown,
      context: {
        vehiclesCollection: Collection<VehiclesModel>;
        partsCollection: Collection<PartsModel>;
      }
    ): Promise<Vehicles[]> => {
      const vehicles = await context.vehiclesCollection.find().toArray();
      return Promise.all(
        vehicles.map((vehiculo) =>
          fromModelToVehicle(vehiculo, context.partsCollection)
        )
      );
    },

    // Consulta todos los repuestos
    parts: async (
        _: unknown,
        __: unknown,
        context: {
          partsCollection: Collection<PartsModel>;
        }
      ): Promise<Parts[]> => {
        const parts = await context.partsCollection.find().toArray();
        return parts.map(fromModelToParts);
      },

    // Consulta vehículos por fabricante
    vehiclesByManufacturer: async (
        _: unknown,
        { manufacturer }: { manufacturer: string },
        context: {
            vehiclesCollection: Collection<VehiclesModel>;
          partsCollection: Collection<PartsModel>;
        }
      ): Promise<Vehicles[]> => {
        const vehiculos = await context.vehiclesCollection
          .find({ manufacturer })
          .toArray();
        return Promise.all(
          vehiculos.map((vehiculo) =>
            fromModelToVehicle(vehiculo, context.partsCollection)
          )
        );
      },

// Consulta repuestos por ID de vehículo
partsByVehicle: async (
    _: unknown,
    { vehicleId }: { vehicleId: string },
    context: {
      partsCollection: Collection<PartsModel>;
    }
  ): Promise<Parts[]> => {
    const parts = await context.partsCollection
      .find({ vehicleId: new ObjectId(vehicleId) })
      .toArray();
    return parts.map(fromModelToParts);
  },

// Consulta vehículos por rango de años
vehiclesByYearRange: async (
    _: unknown,
    { startYear, endYear }: { startYear: number; endYear: number },
    context: {
      vehiclesCollection: Collection<VehiclesModel>;
      partsCollection: Collection<PartsModel>;
    }
  ): Promise<Vehicles[]> => {
    const vehiculos = await context.vehiclesCollection
      .find({
        year: {
          $gte: startYear,
          $lte: endYear,
        },
      })
      .toArray();
    return Promise.all(
      vehiculos.map((vehiculo) =>
        fromModelToVehicle(vehiculo, context.partsCollection)
      )
    );
  },
},

  Mutation: {
    // Agregar un vehículo
    addVehicle: async (
        _: unknown,
        { name, manufacturer, year }: { name: string; manufacturer: string; year: number },
        context: {
          vehiclesCollection: Collection<VehiclesModel>;
        }
      ): Promise<Vehicles> => {
        // Obtén la broma aleatoria
        const joke = await getRandomJoke();
  
        // Inserta el vehículo con la broma aleatoria
        const result = await context.vehiclesCollection.insertOne({
          name,
          manufacturer,
          year,
          joke, // Se incluye la broma en el vehículo
          parts: [],
        });
  
        // Devuelve el vehículo con la broma aleatoria
        return {
          id: result.insertedId.toString(),
          name,
          manufacturer,
          year,
          joke,
          parts: [],
        };
    },

    // Agregar un repuesto
    addPart: async (
      _: unknown,
      { name, price, vehicleId }: { name: string; price: number; vehicleId: string },
      context: {
        partsCollection: Collection<PartsModel>;
        vehiclesCollection: Collection<VehiclesModel>;
      }
    ): Promise<Parts> => {
      const part = {
        name,
        price,
        vehicleId: new ObjectId(vehicleId),
      };
      const result = await context.partsCollection.insertOne(part);

      // Actualiza el vehículo correspondiente
      await context.vehiclesCollection.updateOne(
        { _id: new ObjectId(vehicleId) },
        { $push: { parts: result.insertedId } }
      );

      return {
        id: result.insertedId.toString(),
        name,
        price,
        vehicleId,
      };
    },

// Actualizar un vehículo
updateVehicle: async (
    _: unknown,
    { id, name, manufacturer, year }: { id: string; name?: string; manufacturer?: string; year?: number },
    context: {
      vehiclesCollection: Collection<VehiclesModel>;
    }
  ): Promise<Vehicles | null> => {
    const updates: Partial<VehiclesModel> = { name, manufacturer, year };
  
    // Actualiza el vehículo
    await context.vehiclesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );
  
    // Busca y devuelve el vehículo actualizado
    const updatedVehicle = await context.vehiclesCollection.findOne({ _id: new ObjectId(id) });
  
    if (!updatedVehicle) return null;
  
    return {
      id: updatedVehicle._id.toString(),
      name: updatedVehicle.name,
      manufacturer: updatedVehicle.manufacturer,
      year: updatedVehicle.year,
      joke: updatedVehicle.joke,
      parts: [],
    };
  },
  
// Eliminar un repuesto
// Eliminar una parte
deletePart: async (
    _: unknown,
    { id }: { id: string },
    context: {
      partsCollection: Collection<PartsModel>;
      vehiclesCollection: Collection<VehiclesModel>;
    }
  ): Promise<Parts | null> => {
    // Eliminar la parte
    await context.partsCollection.deleteOne({ _id: new ObjectId(id) });
  
    // Eliminar la referencia de la parte en los vehículos
    await context.vehiclesCollection.updateMany(
      { parts: new ObjectId(id) },
      { $pull: { parts: new ObjectId(id) } }
    );
  
    return null; // O puedes devolver una parte si lo necesitas
  },
  
  },
};
