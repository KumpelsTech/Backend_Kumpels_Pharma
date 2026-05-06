# Usar una imagen base oficial de Node.js
FROM node:20.11.1-alpine

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar solo las dependencias de producción
RUN yarn install

# Copiar el resto de la aplicación
COPY . .

# Exponer el puerto que la aplicación usará
EXPOSE 7001


# Comando para ejecutar la aplicación
CMD ["node", "./src/index.js"]