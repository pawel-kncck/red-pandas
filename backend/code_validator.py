import ast
from typing import Tuple, Set, Optional
from config import settings
import logging

logger = logging.getLogger(__name__)


class SecurityError(Exception):
    """Raised when code contains security violations"""
    pass


class ASTSecurityValidator(ast.NodeVisitor):
    """AST visitor to check for security issues"""

    def __init__(self, forbidden_imports: Set[str], forbidden_builtins: Set[str]):
        self.forbidden_imports = forbidden_imports
        self.forbidden_builtins = forbidden_builtins

    def visit_Import(self, node: ast.Import) -> None:
        """Check import statements"""
        for alias in node.names:
            module_name = alias.name.split('.')[0]
            if module_name in self.forbidden_imports:
                raise SecurityError(f"Forbidden import: {alias.name}")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """Check from ... import statements"""
        if node.module:
            module_name = node.module.split('.')[0]
            if module_name in self.forbidden_imports:
                raise SecurityError(f"Forbidden import: from {node.module}")
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        """Check for forbidden built-in functions"""
        if isinstance(node.ctx, ast.Load) and node.id in self.forbidden_builtins:
            raise SecurityError(f"Forbidden built-in function: {node.id}")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        """Check function calls for dangerous patterns"""
        # Check for getattr/setattr/delattr with string literals
        if isinstance(node.func, ast.Name):
            if node.func.id in ['getattr', 'setattr', 'delattr', 'hasattr']:
                # These can be used to bypass restrictions
                raise SecurityError(f"Forbidden function call: {node.func.id}")

        # Check for string eval patterns like pd.eval()
        if isinstance(node.func, ast.Attribute):
            if node.func.attr in ['eval', 'query']:
                raise SecurityError(f"Forbidden method call: {node.func.attr}")

        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        """Check attribute access for dangerous patterns"""
        # Prevent access to dangerous dunder attributes
        if node.attr.startswith('__') and node.attr.endswith('__'):
            # Allow safe dunder attributes
            safe_dunders = {'__name__', '__doc__', '__class__', '__dict__', '__str__', '__repr__', '__len__', '__getitem__'}
            if node.attr not in safe_dunders:
                raise SecurityError(f"Forbidden dunder attribute: {node.attr}")
        self.generic_visit(node)


class CodeValidator:
    """AST-based code validation for secure execution"""

    def __init__(self):
        self.forbidden_imports = set(settings.FORBIDDEN_IMPORTS)
        self.forbidden_builtins = set(settings.FORBIDDEN_BUILTINS)

    def validate_code(self, code: str) -> Tuple[bool, Optional[str]]:
        """
        Validate code using AST parsing
        Returns: (is_valid, error_message)
        """
        # Check for basic issues
        if not code or not code.strip():
            return False, "Empty code provided"

        if len(code) > 10000:  # Reasonable code length limit
            return False, "Code exceeds maximum length of 10000 characters"

        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error at line {e.lineno}: {e.msg}"

        # Walk through AST and check for forbidden patterns
        validator = ASTSecurityValidator(
            self.forbidden_imports,
            self.forbidden_builtins
        )

        try:
            validator.visit(tree)
        except SecurityError as e:
            logger.warning(f"Security validation failed: {e}")
            return False, str(e)

        # Check for required 'result' variable assignment
        has_result = self._check_result_assignment(tree)
        if not has_result:
            return False, "Code must assign a value to variable 'result'"

        return True, None

    def _check_result_assignment(self, tree: ast.AST) -> bool:
        """Check if code assigns to 'result' variable"""
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == 'result':
                        return True
            elif isinstance(node, ast.AnnAssign):
                if isinstance(node.target, ast.Name) and node.target.id == 'result':
                    return True
        return False