// Test script for language detection
import { detectLanguage } from './src/components/chat/ChatInput.jsx';

// Test TypeScript
const tsCode = `interface User {
  name: string;
  age: number;
}
const user: User = { name: "John", age: 30 };
const result = user?.name;`;

console.log('TypeScript test:', detectLanguage(tsCode));

// Test JavaScript
const jsCode = `const user = { name: "John", age: 30 };
console.log(user);
useState("hello");`;

console.log('JavaScript test:', detectLanguage(jsCode));

// Test Python
const pyCode = `def hello(name):
    print(f"Hello {name}")

class User:
    def __init__(self, name):
        self.name = name`;

console.log('Python test:', detectLanguage(pyCode));

// Test C#
const csCode = `using System;
namespace HelloWorld {
    class Program {
        static void Main(string[] args) {
            var user = new User { Name = "John" };
            Console.WriteLine(user.Name);
        }
    }
}`;

console.log('C# test:', detectLanguage(csCode));