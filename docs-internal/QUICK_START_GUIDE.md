# 🚀 Quick Start Guide: Adding Nodes Made Easy

## **TL;DR: Create Custom Nodes in 30 Seconds**

```bash
# 1. Generate a node with one command
npx clara-studio generate "Create a node that validates email addresses"

# 2. Start development mode
npx clara-studio dev

# 3. Your node is ready to use! 🎉
```

That's it! Your node is automatically:
- ✅ Generated with complete TypeScript code
- ✅ Created with React UI component
- ✅ Equipped with execution logic
- ✅ Packaged with comprehensive tests
- ✅ Documented with examples
- ✅ Registered and ready to use

---

## **🎯 Three Ways to Add Nodes (Pick Your Favorite)**

### **Method 1: Magic Generation** ✨ (Recommended)

Just describe what you want in plain English:

```bash
# Email validator
clara-studio g "Validate email addresses and check if they're disposable"

# Image processor
clara-studio g "Resize images and apply filters like blur, sepia, and brightness"

# Data transformer
clara-studio g "Convert JSON to CSV with custom field mapping and validation"

# AI integration
clara-studio g "Analyze text sentiment using OpenAI and return confidence scores"

# API connector
clara-studio g "Connect to REST APIs with authentication and rate limiting"
```

### **Method 2: Interactive Wizard** 🧙‍♂️

For more control, use the step-by-step wizard:

```bash
clara-studio create-node
```

Answer a few questions:
- What should your node do?
- What inputs does it need?
- What outputs should it provide?
- Any configuration options?

### **Method 3: Batch Creation** 📦

Generate multiple nodes at once:

```bash
# Create a file with your ideas
echo "Email validator
Image resizer
CSV parser
Password generator
QR code creator" > my-nodes.txt

# Generate all at once
clara-studio batch-generate my-nodes.txt
```

---

## **📁 What Gets Generated**

For each node, you get a complete package:

```
generated-nodes/
├── email-validator/
│   ├── email-validator.definition.ts    # Node configuration
│   ├── EmailValidatorNode.tsx          # React component
│   ├── email-validator.executor.ts     # Business logic
│   ├── email-validator.test.ts         # Unit tests
│   ├── email-validator.md              # Documentation
│   └── package.json                    # Plugin manifest
```

### **Example Generated Files**

**Node Definition** (`email-validator.definition.ts`):
```typescript
export const emailValidatorDefinition: NodeDefinition = {
  id: 'email-validator',
  name: 'Email Validator',
  type: 'email-validator',
  category: 'utilities',
  description: 'Validates email addresses and checks for disposable domains',
  icon: '📧',
  version: '1.0.0',
  author: 'Clara Studio',
  inputs: [
    {
      id: 'email',
      name: 'Email Address',
      type: 'input',
      dataType: 'string',
      required: true,
      description: 'Email address to validate'
    }
  ],
  outputs: [
    {
      id: 'isValid',
      name: 'Is Valid',
      type: 'output',
      dataType: 'boolean',
      description: 'Whether the email is valid'
    },
    {
      id: 'isDisposable',
      name: 'Is Disposable',
      type: 'output', 
      dataType: 'boolean',
      description: 'Whether the email is from a disposable domain'
    }
  ],
  executionHandler: emailValidatorExecutor
};
```

**React Component** (`EmailValidatorNode.tsx`):
```typescript
import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';

const EmailValidatorNode = memo<NodeProps>(({ id, data, selected }) => {
  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      title="Email Validator"
      category="utilities"
      icon="📧"
      inputs={[
        {
          id: 'email',
          name: 'Email Address', 
          type: 'input',
          dataType: 'string',
          required: true
        }
      ]}
      outputs={[
        {
          id: 'isValid',
          name: 'Is Valid',
          type: 'output',
          dataType: 'boolean'
        },
        {
          id: 'isDisposable', 
          name: 'Is Disposable',
          type: 'output',
          dataType: 'boolean'
        }
      ]}
    >
      <div className="p-2">
        <p className="text-sm text-gray-600">
          Validates email format and checks disposable domains
        </p>
      </div>
    </BaseNode>
  );
});

export default EmailValidatorNode;
```

**Executor Logic** (`email-validator.executor.ts`):
```typescript
import { Node, ExecutionContext } from '../types';

export async function emailValidatorExecutor(
  node: Node,
  inputs: Record<string, any>,
  context: ExecutionContext
): Promise<any> {
  const { email } = inputs;
  const { logger } = context;

  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);

    // Check if disposable (simplified - you'd use a real service)
    const disposableDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
    const domain = email.split('@')[1];
    const isDisposable = disposableDomains.includes(domain);

    logger.info(`Validated email: ${email}, valid: ${isValid}, disposable: ${isDisposable}`);

    return {
      isValid,
      isDisposable
    };
  } catch (error) {
    logger.error('Email validation failed:', error);
    throw error;
  }
}
```

---

## **🔧 Development Workflow**

### **1. Generate Your Node**
```bash
clara-studio g "Your amazing node idea"
```

### **2. Start Development**
```bash
clara-studio dev
```
- 🔥 Hot reloading enabled
- 📁 File watching active
- ✅ Live validation running

### **3. Test It Out**
- Open your browser (http://localhost:3000)
- Drag your new node onto the canvas
- Connect it to other nodes
- Test the execution

### **4. Customize If Needed**
- Edit the generated files
- Changes appear instantly (hot reload)
- Tests run automatically

### **5. Deploy**
```bash
clara-studio build
```

---

## **🎨 Real Examples You Can Try Right Now**

### **Text Processing Nodes**
```bash
clara-studio g "Extract hashtags and mentions from social media text"
clara-studio g "Convert markdown to HTML with syntax highlighting"
clara-studio g "Generate text summaries using AI with word limit control"
```

### **Image Processing Nodes**
```bash
clara-studio g "Apply Instagram-style filters to images with strength control"
clara-studio g "Extract text from images using OCR with confidence scores"
clara-studio g "Generate thumbnails with smart cropping and multiple sizes"
```

### **Data Processing Nodes**
```bash
clara-studio g "Parse and validate CSV files with custom error reporting"
clara-studio g "Convert between JSON, XML, and YAML formats"
clara-studio g "Merge multiple data sources with conflict resolution"
```

### **API Integration Nodes**
```bash
clara-studio g "Send notifications via Slack, Discord, or Teams"
clara-studio g "Fetch weather data with location geocoding"
clara-studio g "Store and retrieve data from Firebase with authentication"
```

### **AI & ML Nodes**
```bash
clara-studio g "Classify images using pre-trained models"
clara-studio g "Generate embeddings for semantic search"
clara-studio g "Detect objects in images with bounding boxes"
```

---

## **🚀 Advanced Usage**

### **Custom Templates**
Create your own generation templates:

```typescript
// my-template.ts
export const apiTemplate: NodeTemplate = {
  id: 'api-integration',
  name: 'API Integration Template',
  description: 'Template for API integration nodes',
  // ... template definition
};

// Use it
clara-studio g "Connect to Stripe API" --template api-integration
```

### **Plugin Development**
Turn your nodes into shareable plugins:

```bash
# Create a plugin
clara-studio plugin create my-awesome-nodes

# Publish it
npm publish

# Others can install it
clara-studio plugin install my-awesome-nodes
```

### **Batch Operations**
```bash
# Generate from descriptions file
clara-studio bg node-ideas.txt

# Validate all nodes
clara-studio validate ./src/nodes/**/*.ts

# Generate documentation
clara-studio docs
```

---

## **💡 Pro Tips**

### **1. Be Specific in Descriptions**
```bash
# Good ✅
clara-studio g "Resize images to 800x600 pixels with quality preservation"

# Better ✅✅
clara-studio g "Resize images with configurable dimensions, quality settings, and format conversion (JPEG, PNG, WebP)"
```

### **2. Use Batch Generation for Related Nodes**
```bash
echo "Email validator with disposable domain checking
Phone number validator with international format support
Credit card validator with type detection
URL validator with accessibility checking" > validators.txt

clara-studio bg validators.txt
```

### **3. Leverage Hot Reloading**
- Make small changes to generated code
- See results instantly in the browser
- No need to restart the development server

### **4. Test as You Build**
- Generated tests run automatically
- Use the test runner: `npm test`
- Add your own test cases for edge cases

---

## **🎯 Next Steps**

1. **Try the examples above** - Pick one that interests you
2. **Customize the generated code** - Make it your own
3. **Create your first plugin** - Share with the community
4. **Join the community** - Get help and share ideas

---

## **🤝 Getting Help**

- 📖 **[Full Documentation](./PRODUCTION_READY_AGENT_STUDIO.md)**
- 💬 **Discord Community**: Get instant help
- 🐛 **GitHub Issues**: Report bugs or request features
- 📧 **Email Support**: team@clara.ai

---

**Ready to build something amazing?** 🚀

```bash
clara-studio generate "Your brilliant idea here"
```

*The future of visual workflow development starts with a single command.* 