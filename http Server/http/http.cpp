// http.cpp : Этот файл содержит функцию "main". Здесь начинается и заканчивается выполнение программы.
//

#include "pch.h"
#include <iostream>

#include <sstream>
#include <string>

// Для корректной работы freeaddrinfo в MinGW
// Подробнее: http://stackoverflow.com/a/20306451
#define _WIN32_WINNT 0x501
#define CPPCONN_PUBLIC_FUNC 
#include <WinSock2.h>
#include <WS2tcpip.h>
#include <strsafe.h>
#include <vector>
// Необходимо, чтобы линковка происходила с DLL-библиотекой
// Для работы с сокетам
#pragma comment(lib, "Ws2_32.lib")
//#pragma comment(lib, "vs14/mysqlcppconn.lib")
#pragma comment(lib,"Advapi32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "vs14/mysqlcppconn-static.lib")

#pragma warning(disable: 4251)
#include "mysql_connection.h"
#include <cppconn/driver.h>
#include <cppconn/exception.h>
#include <cppconn/resultset.h>
#include <cppconn/statement.h>
#pragma warning(pop)

using std::cerr;

class Player
{
public:
	sql::SQLString name;
	int score;
	Player(sql::SQLString nm, int sc)
	{
		name = nm;
		score = sc;
	}
};


#define safe_delete(p) if (p) \
                          delete p; \
                          p = nullptr

class mysqlbase {
public:
	sql::Connection *m_con;
	sql::Statement  *m_stmt;
	sql::ResultSet  *m_res;
	sql::Driver     *m_driver;
	bool             m_valid_statement;
public:


	static sql::SQLString fmt(const char *fmt, ...) {
		va_list args;
		char szDebugBuffer[1024];
		sql::SQLString result;
		va_start(args, fmt);
		if (SUCCEEDED(StringCchVPrintfA(szDebugBuffer, _countof(szDebugBuffer), fmt, args)))
			result = szDebugBuffer;
		va_end(args);
		return result;
	}

	mysqlbase() :
		m_con(nullptr),
		m_stmt(nullptr),
		m_res(nullptr),
		m_driver(nullptr),
		m_valid_statement(true)
	{
		try {
			m_driver = get_driver_instance();
			m_con = m_driver->connect(("localhost"), ("root"),("root"));
			m_con->setSchema(("plane")); //db name comes here
			m_stmt = m_con->createStatement();
		}
		catch (sql::SQLException &e)
		{
			(void)e;
			m_valid_statement = false;
			printf("failed to initialize database connection\n\n'%s'\n\n", e.what());
		}
	}

	~mysqlbase()
	{
		safe_delete(m_res);
		safe_delete(m_stmt);
		safe_delete(m_con);
	}

	std::vector<Player> GetLeaderboard()
	{

		std::vector<Player> ret;
		if (!m_valid_statement) {
			return ret;
		}
		try
		{
			m_res = m_stmt->executeQuery(fmt("SELECT * FROM leaderboard order by score desc limit 10"));
			while (m_res->next())
			{
				ret.push_back(Player(m_res->getString("name"), m_res->getInt("score")));
			}
			safe_delete(m_res);

		}
		catch (sql::SQLException &e)
		{
			std::cout << "EXCEPTION: " << e.what() << "\n";
		}
		return ret;
	}
	bool SaveResult(Player player)
	{
		bool ret = 0;
		if (!m_valid_statement) {
			printf("failed 1\n");
			return 0;
		}
		try
		{
			ret=m_stmt->execute(fmt("INSERT INTO leaderboard(name,id,score) VALUES ('%s', 0, '%d')", player.name.c_str(), player.score));
		}
		catch (sql::SQLException &e)
		{
			std::cout<<"EXCEPTION: "<< e.what()<<"\n";
		}
		return ret;
	}
};

int main()
{
	mysqlbase database;
	WSADATA wsaData; // служебная структура для хранение информации
	// о реализации Windows Sockets
	// старт использования библиотеки сокетов процессом
	// (подгружается Ws2_32.dll)
	int result = WSAStartup(MAKEWORD(2, 2), &wsaData);

	// Если произошла ошибка подгрузки библиотеки
	if (result != 0) {
		cerr << "WSAStartup failed: " << result << "\n";
		return result;
	}

	struct addrinfo* addr = NULL; // структура, хранящая информацию
	// об IP-адресе  слущающего сокета

	// Шаблон для инициализации структуры адреса
	struct addrinfo hints;
	ZeroMemory(&hints, sizeof(hints));

	hints.ai_family = AF_INET; // AF_INET определяет, что будет
	// использоваться сеть для работы с сокетом
	hints.ai_socktype = SOCK_STREAM; // Задаем потоковый тип сокета
	hints.ai_protocol = IPPROTO_TCP; // Используем протокол TCP
	hints.ai_flags = AI_PASSIVE; // Сокет будет биндиться на адрес,
	// чтобы принимать входящие соединения

	// Инициализируем структуру, хранящую адрес сокета - addr
	// Наш HTTP-сервер будет висеть на 8000-м порту локалхоста
	result = getaddrinfo("127.0.0.1", "8000", &hints, &addr);

	// Если инициализация структуры адреса завершилась с ошибкой,
	// выведем сообщением об этом и завершим выполнение программы
	if (result != 0) {
		cerr << "getaddrinfo failed: " << result << "\n";
		WSACleanup(); // выгрузка библиотеки Ws2_32.dll
		return 1;
	}

	// Создание сокета
	int listen_socket = socket(addr->ai_family, addr->ai_socktype,
		addr->ai_protocol);
	// Если создание сокета завершилось с ошибкой, выводим сообщение,
	// освобождаем память, выделенную под структуру addr,
	// выгружаем dll-библиотеку и закрываем программу
	if (listen_socket == INVALID_SOCKET) {
		cerr << "Error at socket: " << WSAGetLastError() << "\n";
		freeaddrinfo(addr);
		WSACleanup();
		return 1;
	}

	// Привязываем сокет к IP-адресу
	result = bind(listen_socket, addr->ai_addr, (int)addr->ai_addrlen);

	// Если привязать адрес к сокету не удалось, то выводим сообщение
	// об ошибке, освобождаем память, выделенную под структуру addr.
	// и закрываем открытый сокет.
	// Выгружаем DLL-библиотеку из памяти и закрываем программу.
	if (result == SOCKET_ERROR) {
		cerr << "bind failed with error: " << WSAGetLastError() << "\n";
		freeaddrinfo(addr);
		closesocket(listen_socket);
		WSACleanup();
		return 1;
	}

	// Инициализируем слушающий сокет
	if (listen(listen_socket, SOMAXCONN) == SOCKET_ERROR) {
		cerr << "listen failed with error: " << WSAGetLastError() << "\n";
		closesocket(listen_socket);
		WSACleanup();
		return 1;
	}

	// Принимаем входящие соединения
	while (int client_socket = accept(listen_socket, NULL, NULL))
	{
		if (client_socket == INVALID_SOCKET) {
			cerr << "accept failed: " << WSAGetLastError() << "\n";
			closesocket(listen_socket);
			WSACleanup();
			return 1;
		}

		const int max_client_buffer_size = 1024;
		char buf[max_client_buffer_size];

		result = recv(client_socket, buf, max_client_buffer_size, 0);
		std::cout << "Got: " << buf << " END\n";
		std::stringstream response; // сюда будет записываться ответ клиенту
		std::stringstream response_body; // тело ответа

		if (result == SOCKET_ERROR) {
			// ошибка получения данных
			cerr << "recv failed: " << result << "\n";
			closesocket(client_socket);
		}
		else if (result == 0) {
			// соединение закрыто клиентом
			cerr << "connection closed...\n";
		}
		else if (result > 0) {
			// Мы знаем фактический размер полученных данных, поэтому ставим метку конца строки
			// В буфере запроса.
			buf[result] = '\0';

			// Данные успешно получены
			// формируем тело ответа (HTML)
			/*response_body << "<title>Test C++ HTTP Server</title>\n"
				<< "<h1>Test page</h1>\n"
				<< "<p>This is body of the test page...</p>\n"
				<< "<h2>Request headers</h2>\n"
				<< "<pre>" << buf << "</pre>\n"
				<< "<em><small>Test C++ Http Server</small></em>\n";*/
			std::string bufstr(buf);
			auto itr = bufstr.find("SAVE RESULT ");
			if (itr != std::string::npos)
			{
				char name[200];
				int score = 0;
				sscanf_s(bufstr.data()+itr, "SAVE RESULT playername: %s score: %d", name,200,&score);
				database.SaveResult(Player(name, score));
				response_body << name <<" "<<score<<"\n";
				response_body << "RESULT SAVED";
			}
			else
			{
				itr= bufstr.find("GIVE ME LEADERBOARD");
				if (itr != std::string::npos)
				{
					auto leaderboard=database.GetLeaderboard();
					if (leaderboard.size())
					{
						response_body << "[";
						response_body << "{\"name\": \"" << leaderboard[0].name.c_str() << "\", \"score\": "<< leaderboard[0].score <<", \"position\": " << 0 << " }";
						for (int a = 1; a < leaderboard.size(); a++)
						{
							response_body << ",{\"name\": \"" << leaderboard[a].name.c_str() << "\", \"score\": " << leaderboard[a].score << ", \"position\": " << a << " }";
						}
						response_body << "]";
					}
				}
			}
			// Формируем весь ответ вместе с заголовками
			response
				<< "HTTP/1.1 200 OK\r\n"
				<< "Access-Control-Allow-Origin: *\r\n"
				<< "Content-Type: text/html; charset=utf-8\r\n"
				<< "Content-Length: " << response_body.str().length()
				<< "\r\n\r\n"
				<< response_body.str();
			/*response << "HTTP/1.1 200 OK\r\n"
				<< "Version: HTTP/1.1\r\n"
				<< "Content-Type: text/html; charset=utf-8\r\n"
				<< "Content-Length: " << response_body.str().length()
				<< "\r\n\r\n"
				<< response_body.str();*/

			// Отправляем ответ клиенту с помощью функции send
			result = send(client_socket, response.str().c_str(),
				response.str().length(), 0);

			if (result == SOCKET_ERROR) {
				// произошла ошибка при отправле данных
				cerr << "send failed: " << WSAGetLastError() << "\n";
			}
			ZeroMemory(buf,sizeof(buf));
			// Закрываем соединение к клиентом
			closesocket(client_socket);
		}
	}

	// Убираем за собой
	closesocket(listen_socket);
	freeaddrinfo(addr);
	WSACleanup();
	return 0;
}
