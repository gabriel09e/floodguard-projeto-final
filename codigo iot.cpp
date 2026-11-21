#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// =========================
// WIFI
// =========================

const char* WIFI_SSID = "SEU_WIFI";
const char* WIFI_PASSWORD = "SUA_SENHA_AQUI";

// =========================
// MQTT
// =========================

const char* MQTT_SERVER = "broker.hivemq.com";
const int MQTT_PORT = 1883;

const char* MQTT_TOPIC = "floodguard/leituras";

const char* DEVICE_ID = "FloodGuard-ESP32";

// =========================
// PINOS
// =========================

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;

// LEDs
const int LED_VERDE = 25;
const int LED_AMARELO = 26;
const int LED_AZUL = 27;
const int LED_VERMELHO = 32;
const int LED_BRANCO = 33;

// =========================
// CALIBRACAO DO SENSOR
// =========================

// Distancia real aproximada do sensor
// ate o fundo da caixa sem agua.
const float ALTURA_REFERENCIA_CM = 24.0;

// Limite fisico aproximado do HC-SR04
const float DISTANCIA_MINIMA_CM = 3.0;

// Altura maxima util de agua
const float ALTURA_MAXIMA_CM =
    ALTURA_REFERENCIA_CM - DISTANCIA_MINIMA_CM;

// =========================
// LIMITES DE STATUS
// =========================

const float LIMITE_ATENCAO_CM = 5.0;
const float LIMITE_ALERTA_CM = 10.0;
const float LIMITE_EVACUACAO_CM = 15.0;

// =========================
// FILTRO
// =========================

const int NUM_LEITURAS = 5;

// =========================
// OBJETOS
// =========================

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// =========================
// VARIAVEIS
// =========================

float alturaAtual = 0.0;
float alturaAnterior = 0.0;

String statusAtual = "seguro";
String statusAnterior = "seguro";

unsigned long ultimaLeitura = 0;
unsigned long ultimoEnvio = 0;

const unsigned long INTERVALO_LEITURA = 2000;
const unsigned long INTERVALO_MQTT = 5000;

// =========================
// LEITURA DO SENSOR
// =========================

float medirDistancia() {

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  unsigned long duracao =
      pulseIn(ECHO_PIN, HIGH, 30000);

  if (duracao == 0) {
    return -1;
  }

  float distancia =
      (duracao * 0.0343) / 2.0;

  return distancia;
}

// =========================
// MEDIANA
// =========================

float obterMediana() {

  float leituras[NUM_LEITURAS];
  int validas = 0;

  for (int i = 0; i < NUM_LEITURAS; i++) {

    float distancia = medirDistancia();

    if (
      distancia >= DISTANCIA_MINIMA_CM &&
      distancia <= 400.0
    ) {
      leituras[validas] = distancia;
      validas++;
    }

    delay(80);
  }

  if (validas == 0) {
    return -1;
  }

  // Ordenacao
  for (int i = 0; i < validas - 1; i++) {

    for (int j = i + 1; j < validas; j++) {

      if (leituras[j] < leituras[i]) {

        float temp = leituras[i];
        leituras[i] = leituras[j];
        leituras[j] = temp;
      }
    }
  }

  if (validas % 2 == 1) {
    return leituras[validas / 2];
  }

  return (
    leituras[validas / 2 - 1] +
    leituras[validas / 2]
  ) / 2.0;
}

// =========================
// CALCULAR ALTURA
// =========================

float calcularAltura(float distancia) {

  float altura =
      ALTURA_REFERENCIA_CM - distancia;

  if (altura < 0) {
    altura = 0;
  }

  if (altura > ALTURA_MAXIMA_CM) {
    altura = ALTURA_MAXIMA_CM;
  }

  return altura;
}

// =========================
// STATUS
// =========================

String calcularStatus(float altura) {

  if (altura >= LIMITE_EVACUACAO_CM) {
    return "evacuacao";
  }

  if (altura >= LIMITE_ALERTA_CM) {
    return "alerta";
  }

  if (altura >= LIMITE_ATENCAO_CM) {
    return "atencao";
  }

  return "seguro";
}

// =========================
// LEDS
// =========================

void atualizarLEDs(String status) {

  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_AMARELO, LOW);
  digitalWrite(LED_AZUL, LOW);
  digitalWrite(LED_VERMELHO, LOW);

  if (status == "seguro") {

    digitalWrite(LED_VERDE, HIGH);

  } else if (status == "atencao") {

    digitalWrite(LED_AMARELO, HIGH);

  } else if (status == "alerta") {

    digitalWrite(LED_AZUL, HIGH);

  } else if (status == "evacuacao") {

    digitalWrite(LED_VERMELHO, HIGH);
  }
}

// =========================
// TENDENCIA
// =========================

String calcularTendencia() {

  if (alturaAtual > alturaAnterior + 0.2) {
    return "subindo";
  }

  if (alturaAtual < alturaAnterior - 0.2) {
    return "descendo";
  }

  return "estavel";
}

// =========================
// WIFI
// =========================

void conectarWiFi() {

  Serial.print("Conectando ao Wi-Fi");

  digitalWrite(LED_BRANCO, HIGH);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi conectado!");

  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  digitalWrite(LED_BRANCO, LOW);
}

// =========================
// MQTT
// =========================

void conectarMQTT() {

  while (!mqttClient.connected()) {

    Serial.print("Conectando ao MQTT...");

    String clientId =
        String(DEVICE_ID) +
        "-" +
        String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str())) {

      Serial.println(" conectado!");

      digitalWrite(LED_BRANCO, LOW);

    } else {

      Serial.print(" falhou. Estado: ");
      Serial.println(mqttClient.state());

      digitalWrite(LED_BRANCO, HIGH);

      delay(3000);
    }
  }
}

// =========================
// DATA E HORA
// =========================

String obterDataHora() {

  struct tm timeinfo;

  if (!getLocalTime(&timeinfo)) {
    return "sem_data";
  }

  char buffer[30];

  strftime(
    buffer,
    sizeof(buffer),
    "%Y-%m-%d %H:%M:%S",
    &timeinfo
  );

  return String(buffer);
}

// =========================
// PUBLICAR MQTT
// =========================

void publicarMQTT() {

  if (!mqttClient.connected()) {
    conectarMQTT();
  }

  String tendencia =
      calcularTendencia();

  String dataHora =
      obterDataHora();

  StaticJsonDocument<512> doc;

  doc["device_id"] = DEVICE_ID;
  doc["altura"] = alturaAtual;
  doc["distancia"] =
      ALTURA_REFERENCIA_CM - alturaAtual;
  doc["tendencia"] = tendencia;
  doc["status"] = statusAtual;
  doc["data"] = dataHora;

  char payload[512];

  serializeJson(doc, payload);

  mqttClient.publish(
    MQTT_TOPIC,
    payload
  );

  Serial.println();
  Serial.println("=== MQTT ===");
  Serial.println(payload);
}

// =========================
// SETUP
// =========================

void setup() {

  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(LED_AZUL, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  pinMode(LED_BRANCO, OUTPUT);

  digitalWrite(TRIG_PIN, LOW);

  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_AMARELO, LOW);
  digitalWrite(LED_AZUL, LOW);
  digitalWrite(LED_VERMELHO, LOW);
  digitalWrite(LED_BRANCO, LOW);

  Serial.println();
  Serial.println("==============================");
  Serial.println(" FLOODGUARD");
  Serial.println("==============================");

  Serial.print("Referencia: ");
  Serial.print(ALTURA_REFERENCIA_CM);
  Serial.println(" cm");

  Serial.print("Altura maxima: ");
  Serial.print(ALTURA_MAXIMA_CM);
  Serial.println(" cm");

  Serial.println();
  Serial.println("LIMITES:");
  Serial.println("0 - 4.99 cm = SEGURO");
  Serial.println("5 - 9.99 cm = ATENCAO");
  Serial.println("10 - 14.99 cm = ALERTA");
  Serial.println("15+ cm = EVACUACAO");
  Serial.println();

  conectarWiFi();

  mqttClient.setServer(
    MQTT_SERVER,
    MQTT_PORT
  );

  configTime(
    -3 * 3600,
    0,
    "pool.ntp.org",
    "time.nist.gov"
  );

  conectarMQTT();

  Serial.println();
  Serial.println("FloodGuard iniciado!");
}

// =========================
// LOOP
// =========================

void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    conectarWiFi();
  }

  if (!mqttClient.connected()) {
    conectarMQTT();
  }

  mqttClient.loop();

  unsigned long agora = millis();

  // =========================
  // LEITURA
  // =========================

  if (
    agora - ultimaLeitura >=
    INTERVALO_LEITURA
  ) {

    ultimaLeitura = agora;

    float distancia =
        obterMediana();

    if (distancia < 0) {

      Serial.println(
        "ERRO: sensor sem leitura valida"
      );

      digitalWrite(LED_BRANCO, HIGH);

      return;
    }

    digitalWrite(LED_BRANCO, LOW);

    alturaAnterior =
        alturaAtual;

    alturaAtual =
        calcularAltura(distancia);

    statusAnterior =
        statusAtual;

    statusAtual =
        calcularStatus(alturaAtual);

    atualizarLEDs(statusAtual);

    // =========================
    // SERIAL
    // =========================

    Serial.println();
    Serial.println("==============================");

    Serial.print("Distancia: ");
    Serial.print(distancia, 2);
    Serial.println(" cm");

    Serial.print("Nivel da agua: ");
    Serial.print(alturaAtual, 2);
    Serial.println(" cm");

    Serial.print("Status: ");
    Serial.println(statusAtual);

    Serial.print("Tendencia: ");
    Serial.println(calcularTendencia());

    Serial.println("==============================");
  }

  // =========================
  // MQTT
  // =========================

  if (
    agora - ultimoEnvio >=
    INTERVALO_MQTT
  ) {

    ultimoEnvio = agora;

    publicarMQTT();
  }
}