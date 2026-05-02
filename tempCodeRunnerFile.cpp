#include <iostream>
#include <iomanip>

double truncar(double n, int decimales) {
    int factor = 1;
    for (int i = 0; i < decimales; i++) factor *= 10;
    int parte = (int)(n * factor);
    return parte / (double)factor;
}

double redondear(double n, int decimales) {
    int factor = 1;
    for (int i = 0; i < decimales; i++) factor *= 10;
    int parte = (int)(n * factor);
    double resto = n * factor - parte;
    if (resto >= 0.5) parte += 1;
    return parte / (double)factor;
}

int main() {
    double numero;
    int decimales;

    std::cout << "Ingresa un numero: ";
    std::cin >> numero;

    std::cout << "Cuantos decimales (3 o 4): ";
    std::cin >> decimales;

    if (decimales != 3 && decimales != 4) {
        std::cout << "Solo se permite 3 o 4 decimales." << std::endl;
        return 1;
    }

    std::cout << std::fixed << std::setprecision(decimales);
    std::cout << "Truncamiento : " << truncar(numero, decimales) << std::endl;
    std::cout << "Redondeo     : " << redondear(numero, decimales) << std::endl;

    return 0;
}