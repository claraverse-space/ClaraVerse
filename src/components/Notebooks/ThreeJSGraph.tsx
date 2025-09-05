import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { GraphData } from '../../services/claraNotebookService';
import { OrbitControls } from './OrbitControls';
import { X, Network, Link, ChevronRight, Search } from 'lucide-react';

interface ThreeJSGraphProps {
  graphData: GraphData | null;
  onNodeSelect?: (node: any) => void;
  onNodeDeselect?: () => void;
  className?: string;
  selectedNodeId?: string;
}

interface NodeObject {
  sphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshLambertMaterial>;
  outline: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  data: any;
}

interface EdgeObject {
  line: THREE.Mesh<THREE.TubeGeometry, THREE.MeshPhongMaterial>;
  from: NodeObject;
  to: NodeObject;
  data: any;
}

const ThreeJSGraph: React.FC<ThreeJSGraphProps> = ({ 
  graphData, 
  onNodeSelect, 
  onNodeDeselect, 
  className = "",
  selectedNodeId 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<OrbitControls>();
  const nodesRef = useRef<NodeObject[]>([]);
  const edgesRef = useRef<EdgeObject[]>([]);
  const selectedNodeRef = useRef<THREE.Mesh | null>(null);
  const animationRef = useRef<number>();

  // State for selected node details
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [showNodePanel, setShowNodePanel] = useState(false);
  
  // Search functionality state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Entity type configuration with dynamic color assignment
  const entityTypeConfig = {
    processor: { color: 0xe74c3c, size: 8 },
    memory: { color: 0x9b59b6, size: 6 },
    network: { color: 0x27ae60, size: 5 },
    storage: { color: 0x3498db, size: 6 },
    ai: { color: 0xf39c12, size: 7 },
    organization: { color: 0x2980b9, size: 6 },
    person: { color: 0x27ae60, size: 5 },
    concept: { color: 0x95a5a6, size: 4 },
    entity: { color: 0x3498db, size: 5 },
    default: { color: 0x7f8c8d, size: 4 }
  };

  // Dynamic color palette for unknown entity types
  const dynamicColorPalette = [
    0xe74c3c, // Red
    0x3498db, // Blue  
    0x2ecc71, // Green
    0xf39c12, // Orange
    0x9b59b6, // Purple
    0x1abc9c, // Turquoise
    0xe67e22, // Carrot
    0x34495e, // Wet Asphalt
    0x16a085, // Green Sea
    0x27ae60, // Nephritis
    0x2980b9, // Belize Hole
    0x8e44ad, // Wisteria
    0x2c3e50, // Midnight Blue
    0xf1c40f, // Sun Flower
    0xd35400, // Pumpkin
    0xc0392b, // Pomegranate
    0x7f8c8d, // Asbestos
    0x95a5a6, // Concrete
    0xecf0f1, // Clouds
    0xbdc3c7  // Silver
  ];

  // Function to get consistent color for any entity type
  const getEntityTypeConfig = useCallback((entityType: string) => {
    const normalizedType = entityType.toLowerCase();
    
    // Check if we have a predefined config
    if (entityTypeConfig[normalizedType as keyof typeof entityTypeConfig]) {
      return entityTypeConfig[normalizedType as keyof typeof entityTypeConfig];
    }
    
    // Generate consistent color based on entity type string
    let hash = 0;
    for (let i = 0; i < entityType.length; i++) {
      const char = entityType.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use absolute value and modulo to get consistent color index
    const colorIndex = Math.abs(hash) % dynamicColorPalette.length;
    const color = dynamicColorPalette[colorIndex];
    
    // Assign size based on entity type characteristics
    let size = 5; // default size
    if (normalizedType.includes('person') || normalizedType.includes('character')) size = 6;
    if (normalizedType.includes('organization') || normalizedType.includes('company')) size = 7;
    if (normalizedType.includes('location') || normalizedType.includes('place')) size = 6;
    if (normalizedType.includes('concept') || normalizedType.includes('idea')) size = 4;
    if (normalizedType.includes('event') || normalizedType.includes('action')) size = 5;
    
    return { color, size };
  }, []);

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    if (!mountRef.current) return;

    // Scene setup with dark night background
    const scene = new THREE.Scene();
    
    // Dark night background - pure black for elegant look
    scene.background = new THREE.Color(0x000000);
    
    // Add subtle fog for depth and atmosphere
    scene.fog = new THREE.Fog(0x000000, 200, 800);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(150, 150, 250);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Dark night lighting setup - subtle but dramatic
    const ambientLight = new THREE.AmbientLight(0x202040, 0.3); // Very dim blue ambient
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0x4080ff, 0.8); // Cool blue directional
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Add atmospheric colored point lights
    const pointLight1 = new THREE.PointLight(0x00d4ff, 0.6, 400); // Cyan accent
    pointLight1.position.set(-100, 50, 100);
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0x8b5cf6, 0.4, 300); // Purple accent
    pointLight2.position.set(100, -50, -100);
    scene.add(pointLight2);
    
    const pointLight3 = new THREE.PointLight(0x06d6a0, 0.3, 250); // Teal accent
    pointLight3.position.set(0, 100, 0);
    scene.add(pointLight3);
    
    // Add rim lighting for better node definition
    const rimLight = new THREE.DirectionalLight(0x00d4ff, 0.3);
    rimLight.position.set(-50, 0, -50);
    scene.add(rimLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 50;
    controls.maxDistance = 800;
    controls.maxPolarAngle = Math.PI;
    controlsRef.current = controls;

    // Mouse interaction
    addMouseInteraction();

    // Start animation loop
    animate();
  }, []);

  // Enhanced force-directed layout calculation
  const calculateNodePositions = useCallback((nodes: any[], edges: any[]) => {
    const positions: Record<string, [number, number, number]> = {};
    const nodeIds = nodes.map(n => n.id);

    // Initialize positions in a sphere
    nodeIds.forEach((id) => {
      const phi = Math.acos(1 - 2 * Math.random());
      const theta = 2 * Math.PI * Math.random();
      const radius = 150 + Math.random() * 100;

      positions[id] = [
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      ];
    });

    // Force simulation
    for (let i = 0; i < 200; i++) {
      // Repulsion between nodes
      for (let j = 0; j < nodeIds.length; j++) {
        for (let k = j + 1; k < nodeIds.length; k++) {
          const id1 = nodeIds[j];
          const id2 = nodeIds[k];
          const pos1 = positions[id1];
          const pos2 = positions[id2];

          const dx = pos1[0] - pos2[0];
          const dy = pos1[1] - pos2[1];
          const dz = pos1[2] - pos2[2];
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

          const force = 2000 / (distance * distance);
          const fx = (dx / distance) * force * 0.1;
          const fy = (dy / distance) * force * 0.1;
          const fz = (dz / distance) * force * 0.1;

          pos1[0] += fx;
          pos1[1] += fy;
          pos1[2] += fz;
          pos2[0] -= fx;
          pos2[1] -= fy;
          pos2[2] -= fz;
        }
      }

      // Attraction along edges
      edges.forEach(edge => {
        const pos1 = positions[edge.source];
        const pos2 = positions[edge.target];

        if (pos1 && pos2) {
          const dx = pos2[0] - pos1[0];
          const dy = pos2[1] - pos1[1];
          const dz = pos2[2] - pos1[2];
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

          const idealDistance = 80;
          const force = (distance - idealDistance) * 0.02;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          const fz = (dz / distance) * force;

          pos1[0] += fx;
          pos1[1] += fy;
          pos1[2] += fz;
          pos2[0] -= fx;
          pos2[1] -= fy;
          pos2[2] -= fz;
        }
      });
    }

    return positions;
  }, []);

  // Create graph from data
  const createGraph = useCallback(() => {
    if (!graphData || !sceneRef.current) return;

    // Clear existing graph
    nodesRef.current.forEach(nodeObj => {
      sceneRef.current!.remove(nodeObj.sphere);
      sceneRef.current!.remove(nodeObj.outline);
    });
    edgesRef.current.forEach(edgeObj => {
      sceneRef.current!.remove(edgeObj.line);
    });

    nodesRef.current = [];
    edgesRef.current = [];

    const nodePositions = calculateNodePositions(graphData.nodes, graphData.edges);

    // Create nodes
    graphData.nodes.forEach((nodeData) => {
      const entityType = (nodeData.properties?.entity_type || nodeData.type || 'default') as string;
      const config = getEntityTypeConfig(entityType);

      const position = nodePositions[nodeData.id] || [
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200
      ];

      // Create enhanced sphere with matte materials
      const geometry = new THREE.SphereGeometry(config.size, 32, 32);
      const material = new THREE.MeshLambertMaterial({
        color: config.color,
        transparent: false,
        emissive: new THREE.Color(config.color).multiplyScalar(0.15), // Subtle glow for dark background
        emissiveIntensity: 0.2 // Reduced glow intensity for matte look
      });

      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(position[0], position[1], position[2]);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      sphere.userData = {
        ...nodeData,
        entityType: entityType,
        label: nodeData.label || nodeData.properties?.name || nodeData.id,
        description: nodeData.properties?.description || 'No description available',
        originalColor: config.color,
        configSize: config.size
      };

      // Create enhanced outline with glow effect
      const outlineGeometry = new THREE.SphereGeometry(config.size * 1.15, 32, 32);
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
      });
      const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outline.position.copy(sphere.position);

      sceneRef.current!.add(outline);
      sceneRef.current!.add(sphere);
      nodesRef.current.push({ sphere, outline, data: sphere.userData });
    });

    // Create enhanced edges with thicker lines
    graphData.edges.forEach(edgeData => {
      const fromNode = nodesRef.current.find(n => n.data.id === edgeData.source);
      const toNode = nodesRef.current.find(n => n.data.id === edgeData.target);

      if (fromNode && toNode) {
        const points = [
          fromNode.sphere.position.clone(),
          toNode.sphere.position.clone()
        ];

        // Create moderately thick lines using TubeGeometry - reduced width by 50%
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.4, 8, false); // Reduced from 0.8 to 0.4
        const tubeMaterial = new THREE.MeshPhongMaterial({
          color: 0xffffff, // White color for better visibility on dark background
          transparent: true,
          opacity: 0.6, // Slightly increased opacity for better visibility
          emissive: new THREE.Color(0xffffff).multiplyScalar(0.1), // Subtle white glow
          emissiveIntensity: 0.2
        });

        const line = new THREE.Mesh(tubeGeometry, tubeMaterial);
        line.userData = {
          ...edgeData,
          relationship: edgeData.relationship || 'connected'
        };
        sceneRef.current!.add(line);

        edgesRef.current.push({ line: line as any, from: fromNode, to: toNode, data: edgeData });
      }
    });
  }, [graphData, calculateNodePositions, getEntityTypeConfig]);

  // Node selection logic
  const selectNode = useCallback((node: THREE.Mesh) => {
    if (!sceneRef.current) return;

    // Reset all nodes to very dark for better contrast on black background
    nodesRef.current.forEach(nodeObj => {
      (nodeObj.sphere.material as THREE.MeshLambertMaterial).color.setHex(0x1a1a1a); // Very dark grey
      (nodeObj.sphere.material as THREE.MeshLambertMaterial).emissive.setHex(0x000000);
      (nodeObj.sphere.material as THREE.MeshLambertMaterial).emissiveIntensity = 0;
      nodeObj.sphere.scale.setScalar(0.7);
      (nodeObj.outline.material as THREE.MeshBasicMaterial).opacity = 0.1;
    });

    // Dim all edges to be barely visible on dark background
    edgesRef.current.forEach(edge => {
      (edge.line.material as THREE.MeshPhongMaterial).color.setHex(0x333333); // Dark grey for unselected edges
      (edge.line.material as THREE.MeshPhongMaterial).opacity = 0.1; // Very low opacity for background edges
    });

    // Highlight selected node with enhanced glow
    selectedNodeRef.current = node;
    const selectedOriginalColor = node.userData.originalColor;
    (node.material as THREE.MeshLambertMaterial).color.setHex(selectedOriginalColor);
    (node.material as THREE.MeshLambertMaterial).emissive.setHex(0x444444);
    (node.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.4; // Reduced for matte look
    node.scale.setScalar(1.4);

    // Highlight connected nodes
    const connectedNodes = getConnectedNodes(node);
    connectedNodes.forEach(connectedNode => {
      const originalColor = connectedNode.userData.originalColor;
      (connectedNode.material as THREE.MeshLambertMaterial).color.setHex(originalColor);
      (connectedNode.material as THREE.MeshLambertMaterial).emissive.setHex(0x222222);
      (connectedNode.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.2; // Reduced for matte look
      connectedNode.scale.setScalar(1.1);
    });

    // Highlight connected edges
    edgesRef.current.forEach(edge => {
      if (edge.from.sphere === node || edge.to.sphere === node) {
        (edge.line.material as THREE.MeshPhongMaterial).color.setHex(0x00d4ff); // Bright cyan
        (edge.line.material as THREE.MeshPhongMaterial).opacity = 1.0;
        (edge.line.material as THREE.MeshPhongMaterial).emissive.setHex(0x00d4ff);
        (edge.line.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.6; // Stronger glow
      }
    });

    centerCameraOnNode(node);
    
    // Update selected node state for side panel
    setSelectedNodeData(node.userData);
    setShowNodePanel(true);
    
    onNodeSelect?.(node.userData);
  }, [onNodeSelect]);

  const getConnectedNodes = useCallback((selectedNode: THREE.Mesh) => {
    const connectedNodes: THREE.Mesh[] = [];

    edgesRef.current.forEach(edge => {
      if (edge.from.sphere === selectedNode) {
        connectedNodes.push(edge.to.sphere);
      } else if (edge.to.sphere === selectedNode) {
        connectedNodes.push(edge.from.sphere);
      }
    });

    return connectedNodes;
  }, []);

  // Get relationship information between selected node and connected node
  const getRelationshipInfo = useCallback((selectedNode: THREE.Mesh, connectedNode: THREE.Mesh) => {
    const relationship = edgesRef.current.find(edge => 
      (edge.from.sphere === selectedNode && edge.to.sphere === connectedNode) ||
      (edge.to.sphere === selectedNode && edge.from.sphere === connectedNode)
    );
    
    if (relationship) {
      const isOutgoing = relationship.from.sphere === selectedNode;
      return {
        type: relationship.data.relationship || 'connected',
        direction: isOutgoing ? 'outgoing' : 'incoming',
        data: relationship.data
      };
    }
    
    return { type: 'connected', direction: 'bidirectional', data: null };
  }, []);

  const centerCameraOnNode = useCallback((node: THREE.Mesh) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const nodePosition = node.position.clone();
    sceneRef.current!.rotation.y = 0;

    const offset = new THREE.Vector3(60, 40, 60);
    const targetCameraPosition = nodePosition.clone().add(offset);

    const startPosition = cameraRef.current.position.clone();
    const startTarget = controlsRef.current.target.clone();

    let animationProgress = 0;
    const animationDuration = 1200;
    const startTime = performance.now();

    function animateCamera() {
      const currentTime = performance.now();
      animationProgress = Math.min((currentTime - startTime) / animationDuration, 1);

      const easeProgress = 1 - Math.pow(1 - animationProgress, 3);

      cameraRef.current!.position.lerpVectors(startPosition, targetCameraPosition, easeProgress);
      controlsRef.current!.target.lerpVectors(startTarget, nodePosition, easeProgress);
      controlsRef.current!.update();

      if (animationProgress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        controlsRef.current!.target.copy(nodePosition);
        controlsRef.current!.update();
      }
    }

    animateCamera();
  }, []);

  const deselectAllNodes = useCallback(() => {
    if (!sceneRef.current) return;

    nodesRef.current.forEach(nodeObj => {
      const originalColor = nodeObj.sphere.userData.originalColor || 0x6c757d;
      (nodeObj.sphere.material as THREE.MeshLambertMaterial).color.setHex(originalColor);
      (nodeObj.sphere.material as THREE.MeshLambertMaterial).emissive.setHex(0x000000);
      (nodeObj.sphere.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.1; // Subtle for matte look
      nodeObj.sphere.scale.setScalar(1.0);
      (nodeObj.outline.material as THREE.MeshBasicMaterial).opacity = 0.3;
    });

    edgesRef.current.forEach(edge => {
      (edge.line.material as THREE.MeshPhongMaterial).color.setHex(0xffffff); // White edges
      (edge.line.material as THREE.MeshPhongMaterial).opacity = 0.6; // Moderate opacity
      (edge.line.material as THREE.MeshPhongMaterial).emissive.setHex(0xffffff);
      (edge.line.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.1; // Subtle white glow
    });

    selectedNodeRef.current = null;
    
    // Hide the node details panel
    setSelectedNodeData(null);
    setShowNodePanel(false);
    
    onNodeDeselect?.();
  }, [onNodeDeselect]);

  // Mouse interaction
  const addMouseInteraction = useCallback(() => {
    if (!rendererRef.current || !cameraRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      const rect = rendererRef.current!.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current!);
      const spheres = nodesRef.current.map(n => n.sphere);
      const intersects = raycaster.intersectObjects(spheres);

      if (intersects.length > 0) {
        const clickedNode = intersects[0].object as THREE.Mesh;
        selectNode(clickedNode);
      } else {
        deselectAllNodes();
      }
    };

    rendererRef.current.domElement.addEventListener('click', handleClick);

    return () => {
      rendererRef.current?.domElement.removeEventListener('click', handleClick);
    };
  }, [selectNode, deselectAllNodes]);

  // Animation loop
  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
      return;
    }

    controlsRef.current.update();

    // Gentle rotation when no node is selected
    if (!selectedNodeRef.current) {
      sceneRef.current.rotation.y += 0.0005;
    }

    // Animate node glow effects
    nodesRef.current.forEach(nodeObj => {
      const material = nodeObj.sphere.material as THREE.MeshLambertMaterial;
      if (material.emissive.r > 0 || material.emissive.g > 0 || material.emissive.b > 0) {
        const time = Date.now() * 0.003;
        const baseColor = new THREE.Color(nodeObj.sphere.userData.originalColor);
        material.emissive.copy(baseColor).multiplyScalar(0.2 * (0.8 + 0.2 * Math.sin(time))); // Reduced for matte
      }
    });

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Handle window resize
  const handleResize = useCallback(() => {
    if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, []);

  // External node selection
  useEffect(() => {
    if (selectedNodeId && nodesRef.current.length > 0) {
      const node = nodesRef.current.find(n => n.data.id === selectedNodeId);
      if (node) {
        selectNode(node.sphere);
      }
    } else if (!selectedNodeId) {
      deselectAllNodes();
    }
  }, [selectedNodeId, selectNode, deselectAllNodes]);

  // Initialize scene
  useEffect(() => {
    initScene();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [initScene, handleResize]);

  // Create graph when data changes
  useEffect(() => {
    if (graphData) {
      createGraph();
    }
  }, [graphData, createGraph]);

  // Helper function to safely render values
  const renderSafeValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    try {
      return String(value);
    } catch {
      return 'N/A';
    }
  };

  // Search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim() || !graphData) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const results = graphData.nodes.filter(node => {
      const name = renderSafeValue(node.properties?.name || node.id).toLowerCase();
      const type = node.type.toLowerCase();
      const queryLower = query.toLowerCase();
      
      return name.includes(queryLower) || type.includes(queryLower);
    }).slice(0, 10); // Limit to 10 results

    setSearchResults(results);
    setShowSearchResults(true);
  }, [graphData]);

  const handleSearchResultSelect = useCallback((selectedNode: any) => {
    // Find the 3D node object
    const nodeObj = nodesRef.current.find(n => n.data.id === selectedNode.id);
    if (nodeObj) {
      selectNode(nodeObj.sphere);
    }
    
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Main 3D Canvas */}
      <div 
        ref={mountRef} 
        className={`w-full h-full ${className}`}
        style={{ background: 'black' }}
      />
      
      {/* Floating Search Box - Always Visible */}
      <div className="absolute top-4 left-4 z-10">
        <div className="relative">
          <div className="flex items-center bg-black/85 backdrop-blur-xl border border-gray-600/50 rounded-lg w-80 shadow-xl">
            <div className="p-3">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setShowSearchResults(searchQuery.length > 0)}
              onBlur={() => {
                // Delay blur to allow clicking on results
                setTimeout(() => {
                  if (!searchQuery) {
                    setShowSearchResults(false);
                  }
                }, 150);
              }}
              className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm py-2 pr-2"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="p-2 hover:bg-gray-700/50 rounded transition-colors mr-1"
                title="Clear search"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-xl border border-gray-600/50 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-20">
              {searchResults.map((node, index) => {
                const nodeName = renderSafeValue(node.properties?.name || node.id);
                const nodeType = node.type || 'Unknown';
                const config = getEntityTypeConfig(nodeType);
                
                return (
                  <button
                    key={`${node.id}-${index}`}
                    onClick={() => handleSearchResultSelect(node)}
                    className="w-full p-3 text-left hover:bg-gray-800/50 transition-colors border-b border-gray-700/30 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `#${config.color.toString(16).padStart(6, '0')}` }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {nodeName}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          {nodeType}
                        </p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No Results Message */}
          {showSearchResults && searchResults.length === 0 && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-xl border border-gray-600/50 rounded-lg shadow-2xl p-4 text-center">
              <p className="text-sm text-gray-400">No nodes found for "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Node Details Side Panel */}
      {showNodePanel && selectedNodeData && (
        <div className="absolute top-4 right-4 bottom-4 w-80 bg-black/90 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl text-white overflow-hidden flex flex-col">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gradient-to-r from-blue-600/20 to-purple-600/20 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/30 rounded-lg">
                <Network className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="font-semibold text-blue-100">Node Details</h3>
            </div>
            <button
              onClick={() => {
                setShowNodePanel(false);
                setSelectedNodeData(null);
              }}
              className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          {/* Panel Content */}
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* Node Name/ID */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Node</label>
              <p className="text-lg font-semibold text-white mt-1 break-words">
                {renderSafeValue(selectedNodeData.label || selectedNodeData.properties?.name || selectedNodeData.id)}
              </p>
            </div>
            
            {/* Node Type */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Type</label>
              <div className="flex items-center gap-2 mt-1">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: `#${selectedNodeData.originalColor?.toString(16).padStart(6, '0') || '6c757d'}` 
                  }}
                />
                <span className="text-white capitalize">
                  {renderSafeValue(selectedNodeData.type || 'Unknown')}
                </span>
              </div>
            </div>
            
            {/* Node ID */}
            {selectedNodeData.id && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">ID</label>
                <p className="text-sm text-gray-300 mt-1 font-mono break-all">
                  {selectedNodeData.id}
                </p>
              </div>
            )}
            
            {/* Properties */}
            {selectedNodeData.properties && Object.keys(selectedNodeData.properties).length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 block">Properties</label>
                <div className="space-y-3">
                  {Object.entries(selectedNodeData.properties).map(([key, value]) => (
                    <div key={key} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-blue-400 capitalize">
                          {key}:
                        </span>
                        <span className="text-sm text-gray-200 text-right break-words max-w-48">
                          {renderSafeValue(value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Connection Info & Statistics */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Network Analysis</label>
              
              {/* Connection Summary */}
              <div className="flex items-center gap-2 mt-1 mb-3">
                <Link className="w-4 h-4 text-cyan-400" />
                <span className="text-white">
                  {selectedNodeRef.current ? getConnectedNodes(selectedNodeRef.current).length : 0} connected nodes
                </span>
              </div>

              {/* Network Statistics */}
              {selectedNodeRef.current && (
                <div className="bg-gray-800/30 rounded-lg p-3 mb-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Degree Centrality:</span>
                    <span className="text-cyan-400 font-medium">
                      {getConnectedNodes(selectedNodeRef.current).length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Network Reach:</span>
                    <span className="text-green-400 font-medium">
                      {Math.round((getConnectedNodes(selectedNodeRef.current).length / (nodesRef.current.length || 1)) * 100)}%
                    </span>
                  </div>
                  {selectedNodeRef.current && getConnectedNodes(selectedNodeRef.current).length > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Hub Rank:</span>
                      <span className="text-purple-400 font-medium">
                        {getConnectedNodes(selectedNodeRef.current).length >= 5 ? 'Major Hub' : 
                         getConnectedNodes(selectedNodeRef.current).length >= 3 ? 'Hub' : 
                         getConnectedNodes(selectedNodeRef.current).length >= 1 ? 'Connected' : 'Isolated'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Connected Nodes List */}
              {selectedNodeRef.current && getConnectedNodes(selectedNodeRef.current).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-cyan-400 uppercase tracking-wide">Connected Nodes</label>
                    <span className="text-xs text-gray-500">
                      {getConnectedNodes(selectedNodeRef.current).length} total
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {getConnectedNodes(selectedNodeRef.current).map((connectedNode, index) => {
                      const nodeData = connectedNode.userData;
                      const nodeName = renderSafeValue(nodeData.label || nodeData.properties?.name || nodeData.id);
                      const nodeType = nodeData.type || 'Unknown';
                      const relationship = getRelationshipInfo(selectedNodeRef.current!, connectedNode);
                      
                      return (
                        <div 
                          key={`${nodeData.id}-${index}`} 
                          className="bg-gray-800/30 rounded-lg p-2 border border-gray-700/30 hover:bg-gray-700/30 cursor-pointer transition-colors"
                          onClick={() => {
                            // Select the connected node
                            selectNode(connectedNode);
                          }}
                          title={`Click to focus on ${nodeName}`}
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ 
                                backgroundColor: `#${nodeData.originalColor?.toString(16).padStart(6, '0') || '6c757d'}` 
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">
                                {nodeName}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400 capitalize">{nodeType}</span>
                                {relationship.type !== 'connected' && (
                                  <>
                                    <span className="text-gray-600">•</span>
                                    <span className="text-cyan-400 capitalize">
                                      {relationship.direction === 'outgoing' ? '→' : '←'} {relationship.type}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Relationship Analysis */}
              {selectedNodeRef.current && getConnectedNodes(selectedNodeRef.current).length > 0 && (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-medium text-yellow-400 uppercase tracking-wide">Relationship Types</label>
                  <div className="space-y-1">
                    {(() => {
                      const relationships = getConnectedNodes(selectedNodeRef.current!).map(node => 
                        getRelationshipInfo(selectedNodeRef.current!, node)
                      );
                      const relationshipCounts = relationships.reduce((acc, rel) => {
                        const key = rel.type;
                        acc[key] = (acc[key] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);

                      return Object.entries(relationshipCounts).map(([type, count]) => (
                        <div key={type} className="bg-gray-800/20 rounded px-2 py-1 flex justify-between text-xs">
                          <span className="text-gray-300 capitalize">{type}</span>
                          <span className="text-yellow-400 font-medium">{count}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Additional Node Insights */}
              {selectedNodeRef.current && (
                <div className="mt-3 p-3 bg-gray-800/20 rounded-lg">
                  <label className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-2 block">
                    Node Insights
                  </label>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Position in Network:</span>
                      <span className="text-blue-400">
                        {getConnectedNodes(selectedNodeRef.current).length === 0 ? 'Isolated' :
                         getConnectedNodes(selectedNodeRef.current).length >= Math.max(1, Math.floor(nodesRef.current.length * 0.1)) ? 'Central' : 'Peripheral'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Connection Strength:</span>
                      <span className="text-green-400">
                        {getConnectedNodes(selectedNodeRef.current).length >= 10 ? 'Very High' :
                         getConnectedNodes(selectedNodeRef.current).length >= 5 ? 'High' :
                         getConnectedNodes(selectedNodeRef.current).length >= 3 ? 'Medium' :
                         getConnectedNodes(selectedNodeRef.current).length >= 1 ? 'Low' : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Network Influence:</span>
                      <span className="text-purple-400">
                        {Math.round((getConnectedNodes(selectedNodeRef.current).length / (nodesRef.current.length || 1)) * 100)}% reach
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* No connections message */}
              {selectedNodeRef.current && getConnectedNodes(selectedNodeRef.current).length === 0 && (
                <div className="text-center py-4 mt-3">
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-2">This node has no connections</p>
                    <p className="text-xs text-gray-500">
                      It exists independently in the knowledge graph
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Panel Footer */}
          <div className="p-3 border-t border-gray-700/50 bg-gray-900/50 flex-shrink-0">
            <p className="text-xs text-gray-500 text-center">
              Click elsewhere to deselect • Drag to explore connections
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeJSGraph;
